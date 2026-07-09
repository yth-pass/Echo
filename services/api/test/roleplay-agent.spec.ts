import { RoleplayAgentService } from '../src/onboarding/roleplay-agent.service';
import type { OnboardingSurveyJson } from '../src/onboarding/survey-schema';

// Minimal mocks — buildPersonaContext 不依赖 prisma / llm
const mockPrisma = {} as any;
const mockLlm = {} as any;

describe('buildPersonaContext', () => {
  let service: RoleplayAgentService;

  beforeEach(() => {
    service = new RoleplayAgentService(mockPrisma, mockLlm);
  });

  /** 构造带完整 personaSketch 的 survey */
  function makeFullSurvey(): OnboardingSurveyJson {
    return {
      identity: { displayName: '林溪' } as any,
      personaSketch: {
        narrative: '林溪是一个温柔而内向的设计师，热爱咖啡与胶片摄影。',
        sections: {
          identityNarrative: '在上海长大的创意工作者',
          personalityTexture: '安静、细腻、偶尔冒出冷幽默',
          coreBeliefs: '相信真诚的连接比社交数量更重要',
          valuesInAction: '会把周末留给好友而非应酬',
          caringStyle: '默默记住你说过的话，过几天再提起',
          socialBoundaries: '不主动分享私人生活',
          contradictions: '嘴上说不喜欢社交，但每次聚会都是最后走的那个人',
          voiceAnchors: ['嗯…怎么说呢', '哈哈哈好吧'],
        },
        generationTimestamp: Date.now(),
      },
    };
  }

  /** 构造 sections 缺失的 personaSketch */
  function makeSketchWithoutSections(): OnboardingSurveyJson {
    return {
      identity: { displayName: '阿明' } as any,
      personaSketch: {
        narrative: '阿明是一个热爱户外运动的工程师。',
        sections: undefined as any,
        generationTimestamp: Date.now(),
      },
    };
  }

  // ---- 其他角色统一走标准路径，disappointed 有专属画像注入 ----

  it.each(['stranger', 'bestfriend', 'crush'] as const)(
    '%s 角色在 sections 为 undefined 时不抛异常',
    (role) => {
      const survey = makeSketchWithoutSections();
      expect(() =>
        (service as any).buildPersonaContext(survey, role),
      ).not.toThrow();

      const result = (service as any).buildPersonaContext(survey, role);
      expect(result).toContain('关于阿明的一些特征');
    },
  );

  it('bestfriend 角色正常注入 personalityTexture 和 caringStyle', () => {
    const survey = makeFullSurvey();
    const result = (service as any).buildPersonaContext(survey, 'bestfriend');

    expect(result).toContain('关于林溪的一些特征');
    expect(result).toContain('安静、细腻');
    expect(result).toContain('默默记住你说过的话');
    expect(result).not.toContain('内在矛盾');
  });

  // ---- disappointed 专属：画像 + 矛盾注入（因为之前有过好感，了解对方） ----

  it('disappointed 角色应注入完整画像及 contradictions 段落', () => {
    const survey = makeFullSurvey();
    const result = (service as any).buildPersonaContext(survey, 'disappointed');

    expect(result).toContain('你认识的林溪');
    expect(result).toContain('林溪是一个温柔而内向的设计师');
    expect(result).toContain('林溪的内在矛盾');
    expect(result).toContain('嘴上说不喜欢社交');
    expect(result).toContain('自然地追问');
  });

  it('disappointed 角色在 sections 缺失时不抛异常', () => {
    const survey = makeSketchWithoutSections();
    const result = (service as any).buildPersonaContext(survey, 'disappointed');

    expect(result).toContain('你认识的阿明');
    expect(result).toContain('阿明是一个热爱户外运动的工程师');
    expect(result).not.toContain('内在矛盾');
  });

  it('disappointed 的 contradictions 为空字符串时不注入矛盾段落', () => {
    const survey = makeFullSurvey();
    survey.personaSketch!.sections.contradictions = '   ';
    const result = (service as any).buildPersonaContext(survey, 'disappointed');

    expect(result).toContain('你认识的林溪');
    expect(result).not.toContain('内在矛盾');
  });

  it('personaSketch 为 undefined 时返回空字符串', () => {
    const survey: OnboardingSurveyJson = { displayName: '测试' };
    const result = (service as any).buildPersonaContext(survey, 'stranger');
    expect(result).toBe('');
  });
});
