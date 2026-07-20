/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 0 — 12 个渐进式名片字段配置
 * 字段顺序 = 用户作答顺序
 */

import type { Phase0FieldDef } from './onboarding-v2.types';

const MAJOR_CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉',
  '南京', '西安', '苏州', '天津', '长沙', '郑州', '青岛', '大连',
  '厦门', '宁波', '东莞', '佛山', '昆明', '合肥', '福州', '哈尔滨',
  '济南', '沈阳', '贵阳', '太原', '石家庄', '兰州', '海口', '拉萨',
  '呼和浩特', '南宁', '银川', '西宁', '乌鲁木齐',
];

const EDUCATION_OPTIONS = [
  { value: 'highschool', label: '高中 / 中专' },
  { value: 'college', label: '大专' },
  { value: 'bachelor', label: '本科' },
  { value: 'master', label: '硕士' },
  { value: 'phd', label: '博士' },
];

const OCCUPATION_OPTIONS = [
  { value: '互联网/科技', label: '互联网 / 科技' },
  { value: '金融', label: '金融' },
  { value: '教育', label: '教育' },
  { value: '医疗/健康', label: '医疗 / 健康' },
  { value: '设计/创意', label: '设计 / 创意' },
  { value: '媒体/传播', label: '媒体 / 传播' },
  { value: '法律/咨询', label: '法律 / 咨询' },
  { value: '制造业/工程', label: '制造业 / 工程' },
  { value: '学生', label: '学生' },
  { value: '其他', label: '其他' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'nonbinary', label: '非二元' },
  { value: 'unspecified', label: '不想说' },
];

const ENTREPRENEURSHIP_FIELDS = [
  { value: '科技/互联网', label: '科技 / 互联网' },
  { value: '消费品/零售', label: '消费品 / 零售' },
  { value: '教育/培训', label: '教育 / 培训' },
  { value: '医疗/健康', label: '医疗 / 健康' },
  { value: '金融/投资', label: '金融 / 投资' },
  { value: '文化/创意', label: '文化 / 创意' },
  { value: '餐饮/食品', label: '餐饮 / 食品' },
  { value: '制造/硬件', label: '制造 / 硬件' },
  { value: '其他', label: '其他' },
];

const AGE_OPTIONS = [
  { value: '18-22', label: '18-22' },
  { value: '23-27', label: '23-27' },
  { value: '28-32', label: '28-32' },
  { value: '33-38', label: '33-38' },
  { value: '39-45', label: '39-45' },
  { value: '46+', label: '46+' },
];

const GOAL_OPTIONS = [
  { value: '认真约会', label: '认真约会' },
  { value: '先交朋友', label: '先交朋友' },
  { value: '慢慢来', label: '慢慢来，看看感觉' },
  { value: '自我探索', label: '自我探索' },
];

export const PHASE0_FIELDS: Phase0FieldDef[] = [
  {
    key: 'displayName',
    label: '你希望怎么被称呼？',
    subtitle: '在 Echo 上大家怎么叫你？',
    echoHint: '你的回声会用这个名字和你说话',
    required: true,
    inputType: 'text',
    placeholder: '比如：小明、Echo、阿杰…',
    maxLength: 20,
  },
  {
    key: 'genderIdentity',
    label: '你的性别认同',
    echoHint: '我们用你定义的方式称呼你',
    required: true,
    inputType: 'choice',
    choices: GENDER_OPTIONS,
  },
  {
    key: 'ageBand',
    label: '你的年龄段',
    echoHint: '年龄只用于匹配相近阅历的对话',
    required: true,
    inputType: 'choice',
    choices: AGE_OPTIONS,
  },
  {
    key: 'hometownCity',
    label: '你在哪个城市长大？',
    subtitle: '成长的地方',
    echoHint: '成长的地方，影响你说话和想事的方式',
    required: true,
    inputType: 'autocomplete',
    suggestions: MAJOR_CITIES,
    placeholder: '输入城市名',
  },
  {
    key: 'currentCity',
    label: '你现在住在哪个城市？',
    echoHint: '同城的人更容易有共同的话题',
    required: true,
    inputType: 'autocomplete',
    suggestions: MAJOR_CITIES,
    placeholder: '输入城市名',
  },
  {
    key: 'education',
    label: '最高教育程度',
    echoHint: '学习路径塑造了你看世界的方式',
    required: true,
    inputType: 'choice',
    choices: EDUCATION_OPTIONS,
  },
  {
    key: 'occupation',
    label: '你的职业 / 领域',
    echoHint: '职业是你每天聊天的语境',
    required: true,
    inputType: 'choice',
    choices: OCCUPATION_OPTIONS,
  },
  {
    key: 'industry',
    label: '所在行业',
    subtitle: '你所在的行业领域是？',
    echoHint: '行业只是坐标，不定义你是谁',
    required: true,
    inputType: 'choice',
    choices: [
      { value: '互联网/科技', label: '互联网/科技' },
      { value: '金融/投资', label: '金融/投资' },
      { value: '教育/学术', label: '教育/学术' },
      { value: '医疗/健康', label: '医疗/健康' },
      { value: '公务员/事业单位', label: '公务员/事业单位' },
      { value: '媒体/内容', label: '媒体/内容' },
      { value: '创业', label: '创业' },
      { value: '学生', label: '学生' },
      { value: '自由职业', label: '自由职业' },
      { value: '制造/工程', label: '制造/工程' },
      { value: '文化/艺术', label: '文化/艺术' },
      { value: '其他', label: '其他' },
    ],
  },
  {
    key: 'entrepreneurshipField',
    label: '创业领域',
    subtitle: '你的创业方向是？',
    echoHint: '不同的赛道，不同的故事',
    required: false,
    inputType: 'choice',
    choices: ENTREPRENEURSHIP_FIELDS,
    showWhen: { field: 'industry', value: '创业' },
    skipLabel: '跳过',
  },
  {
    key: 'workDescription',
    label: '具体做什么工作？',
    subtitle: '简短描述即可',
    echoHint: '具体一点——写代码的和做 AI 的，聊起来完全不一样',
    required: false,
    inputType: 'text',
    maxLength: 20,
    placeholder: '比如：写代码的',
    skipLabel: '跳过',
  },
  {
    key: 'keyLifeExperiences',
    label: '关键人生经历',
    subtitle: '1-3 条改变过你的事，每条建议至少 5 个字',
    echoHint: '经历越具体，对话越像你',
    required: false,
    inputType: 'tag-input',
    minItems: 1,
    maxItems: 3,
    itemMaxLength: 80,
    recommendedMin: 5,
    placeholder: '比如：gap year',
    skipLabel: '跳过',
  },
  {
    key: 'selfIntroOneLiner',
    label: '一句话介绍自己',
    echoHint: '这句会成为你开场白的第一印象',
    required: false,
    inputType: 'text',
    maxLength: 30,
    recommendedMin: 10,
    placeholder: '比如：一个喜欢发呆的程序员',
    skipLabel: '跳过',
  },
  {
    key: 'goalOnEcho',
    label: '注册 Echo 的目标',
    echoHint: '不同目标匹配不同节奏的对话',
    required: false,
    inputType: 'choice',
    choices: GOAL_OPTIONS,
    skipLabel: '跳过',
  },
  {
    key: 'familyMembers',
    label: '家庭信息（可选）',
    subtitle: '添加你愿意分享的家庭成员，后续可在 Profile 中补充',
    echoHint: '家庭背景让聊天更有语境。不想说的可以跳过',
    required: false,
    inputType: 'family-input',
    placeholder: '例如：爸爸是老师 / 妹妹在读研',
  },
  // ─── 匹配偏好 / 理想型 ─────────────────────────────────────────────────────
  {
    key: 'matchPreferredGender',
    label: '你希望匹配什么性别的人？',
    subtitle: '帮助我们找到更合适的对话对象',
    echoHint: '你随时可以调整这个偏好',
    required: false,
    inputType: 'choice',
    choices: [
      { value: 'male', label: '男性' },
      { value: 'female', label: '女性' },
      { value: 'any', label: '都可以' },
    ],
    skipLabel: '跳过',
  },
  {
    key: 'matchPreferredAgeBand',
    label: '希望对方年龄段',
    echoHint: '相近的阅历让对话更容易展开',
    required: false,
    inputType: 'choice',
    choices: AGE_OPTIONS,
    skipLabel: '跳过',
  },
  {
    key: 'matchPreferredCity',
    label: '希望对方所在城市',
    subtitle: '同城或异地都可以',
    echoHint: '异地也能有好的连接',
    required: false,
    inputType: 'autocomplete',
    suggestions: MAJOR_CITIES,
    placeholder: '输入城市名',
    skipLabel: '跳过',
  },
  {
    key: 'matchPreferredOccupation',
    label: '希望对方职业 / 领域',
    echoHint: '选不选都行，Echo 不只看职业匹配',
    required: false,
    inputType: 'choice',
    choices: OCCUPATION_OPTIONS,
    skipLabel: '跳过',
  },
];
