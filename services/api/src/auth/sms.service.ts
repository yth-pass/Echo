import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
// 阿里云号码认证服务（Dypnsapi）SDK —— 用于「发送短信验证码 / 校验短信验证码」
// 关键特性：验证码由阿里云侧随机生成并直接下发用户手机，后端拿不到明文，
//           校验时须回调阿里云 CheckSmsVerifyCode 比对，不可本地比对。
import DypnsapiClient from '@alicloud/dypnsapi20170525';
import {
  SendSmsVerifyCodeRequest,
  CheckSmsVerifyCodeRequest,
} from '@alicloud/dypnsapi20170525';

/**
 * 阿里云短信验证码服务封装。
 *
 * 基于号码认证服务（Dypnsapi）的 SendSmsVerifyCode / CheckSmsVerifyCode 接口：
 * - 发送：阿里云生成验证码 → 下发短信 → 返回 bizId（不含明文码）
 * - 校验：把用户输入的码 + 手机号回传阿里云 → 返回 verifyResult（PASS / FAIL）
 *
 * 本地开发不调用本服务（由 OTP_DEV_CODE 兜底，走 Redis 明文比对），仅在
 * OTP_DEV_CODE 为空且阿里云凭证齐全时启用，避免浪费短信条数。
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: DypnsapiClient | null = null;
  private readonly enabled: boolean;

  constructor() {
    const akId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim();
    const akSecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim();
    this.enabled = !!(akId && akSecret);

    if (this.enabled) {
      // Config 类型来自 @alicloud/openapi-core，跨版本字段稳定，用 as any 规避 d.ts 缺失
      this.client = new DypnsapiClient({
        accessKeyId: akId,
        accessKeySecret: akSecret,
        endpoint: 'dypnsapi.aliyuncs.com',
      } as any);
      this.logger.log('阿里云短信验证码服务已启用');
    } else {
      this.logger.warn('阿里云凭证缺失（ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET），SmsService 未启用');
    }
  }

  get isReady(): boolean {
    return this.enabled && !!this.client;
  }

  /**
   * 发送短信验证码（阿里云 Dypnsapi SendSmsVerifyCode）。
   *
   * 统一验证机制：设置 returnVerifyCode=true 让阿里云回传明文码，
   * 后端拿到后存 Redis 自行校验，不再依赖 CheckSmsVerifyCode 回调。
   * 这样 dev/prod 校验逻辑完全一致（都是 Redis 明文比对），且不受阿里云校验接口余额影响。
   *
   * @param phone 已规范化的手机号（纯数字）
   * @returns 阿里云生成的验证码明文 + 业务流水号 bizId
   */
  async sendVerifyCode(phone: string): Promise<{ code: string; bizId?: string }> {
    if (!this.isReady) {
      throw new ServiceUnavailableException('短信服务未配置，请联系管理员');
    }

    const signName = process.env.SMS_SIGN_NAME?.trim();
    const templateCode = process.env.SMS_TEMPLATE_CODE?.trim();
    const validMinutes = Number(process.env.SMS_CODE_VALID_MINUTES ?? '5');

    if (!signName || !templateCode) {
      throw new ServiceUnavailableException('短信签名/模板未配置（SMS_SIGN_NAME / SMS_TEMPLATE_CODE）');
    }

    // 模板参数：##code## 为阿里云动态验证码占位符（系统生成并替换），min 为有效期分钟数
    const templateParam = JSON.stringify({
      code: '##code##',
      min: String(validMinutes),
    });

    const request = new SendSmsVerifyCodeRequest({
      phoneNumber: phone,
      signName,
      templateCode,
      templateParam,
      interval: 60,
      validTime: validMinutes * 60,
      // 关键：回传明文码，后端存 Redis 自行校验（统一 dev/prod 验证逻辑）
      returnVerifyCode: true,
    });

    try {
      const resp = await this.client!.sendSmsVerifyCode(request);
      const body = resp?.body;
      if (!body?.success) {
        const msg = body?.message || '阿里云发送短信失败';
        this.logger.error(`发送验证码失败 phone=${phone} code=${body?.code} msg=${msg}`);
        throw new ServiceUnavailableException(`短信发送失败：${msg}`);
      }
      const bizId = body.model?.bizId;
      const code = body.model?.verifyCode;
      if (!code) {
        this.logger.error(`阿里云未回传验证码明文 phone=${phone}，请检查 returnVerifyCode 参数`);
        throw new ServiceUnavailableException('短信服务返回异常，请稍后重试');
      }
      this.logger.log(`验证码已发送 phone=${phone} bizId=${bizId ?? '-'}`);
      return { code, bizId };
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      this.logger.error(`阿里云调用异常 phone=${phone}: ${(e as Error).message}`);
      throw new ServiceUnavailableException('短信服务暂时不可用，请稍后重试');
    }
  }

  /**
   * 校验短信验证码（回传阿里云比对）。
   * @param phone 已规范化的手机号
   * @param code 用户输入的验证码
   * @returns true=校验通过，false=验证码错误或已失效
   */
  async checkVerifyCode(phone: string, code: string): Promise<boolean> {
    if (!this.isReady) {
      throw new ServiceUnavailableException('短信服务未配置，请联系管理员');
    }

    const request = new CheckSmsVerifyCodeRequest({
      phoneNumber: phone,
      verifyCode: code,
    });

    try {
      const resp = await this.client!.checkSmsVerifyCode(request);
      const body = resp?.body;
      // 阿里云返回结构：body.success (请求是否成功) + body.model.verifyResult ('PASS'/'UNKNOWN')
      const passed = !!body?.success && body.model?.verifyResult === 'PASS';
      // 完整打印阿里云返回，便于诊断
      this.logger.log(
        `校验结果 phone=${phone} success=${body?.success} code=${body?.code} ` +
        `verifyResult=${body?.model?.verifyResult ?? '-'} passed=${passed}`,
      );
      return passed;
    } catch (e) {
      // 阿里云在验证码错误时抛 isv.ValidateFail 异常（而非返回 verifyResult=UNKNOWN）
      const msg = (e as Error).message;
      this.logger.error(`阿里云校验异常 phone=${phone}: ${msg}`);
      return false;
    }
  }
}
