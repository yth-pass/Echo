import {
  buildTextForEmbedding,
  type OnboardingSurveyJson,
} from '../src/onboarding/survey-schema';

describe('buildTextForEmbedding', () => {
  const userId = 'user-123';

  it('builds structured text from full profile and survey', () => {
    const survey: OnboardingSurveyJson = {
      displayName: '林溪',
      city: '上海',
      goal: '认真约会',
      interests: ['艺术', '电影', '咖啡'],
      toneTags: ['温柔', '幽默'],
      valuesChoices: [
        { questionId: 'pace', choiceId: 'slow', label: '慢热，先线上聊透' },
        { questionId: 'conflict', choiceId: 'talk', label: '直接沟通说清楚' },
      ],
    };

    const text = buildTextForEmbedding(
      {
        displayName: '林溪的分身',
        gender: '女',
        birthYear: 1995,
        city: '上海',
        styleMd: '语气温柔，回复简短',
        bioJson: survey,
      },
      survey,
      userId,
    );

    expect(text).toContain('昵称:林溪的分身');
    expect(text).toContain('性别:女');
    expect(text).toContain('年龄:1995');
    expect(text).toContain('城市:上海');
    expect(text).toContain('兴趣:艺术,电影,咖啡');
    expect(text).toContain('关系意图:认真约会');
    expect(text).toContain('沟通风格:语气温柔，回复简短');
    expect(text).toContain('价值观:慢热，先线上聊透,直接沟通说清楚');
    expect(text).toContain('语气:温柔,幽默');
    expect(text).toMatch(/ \| /);
    expect(text).not.toContain('undefined');
  });

  it('falls back to userId when no embedding fields are present', () => {
    expect(buildTextForEmbedding(null, {}, userId)).toBe(userId);
  });

  it('omits empty label segments', () => {
    const text = buildTextForEmbedding(
      { displayName: '小明', bioJson: {} },
      { city: '北京' },
      userId,
    );

    expect(text).toBe('昵称:小明 | 城市:北京');
    expect(text).not.toContain('性别:');
    expect(text).not.toContain('undefined');
  });

  it('uses datingGoal from bioJson when goal is missing', () => {
    const text = buildTextForEmbedding(
      {
        displayName: '测试',
        bioJson: { datingGoal: 'serious', personality: ['outgoing', 'romantic'] },
      },
      {},
      userId,
    );

    expect(text).toContain('关系意图:serious');
    expect(text).toContain('性格:outgoing,romantic');
  });

  it('v2.2 keyLifeExperiences array takes priority over old keyExperience', () => {
    const survey: OnboardingSurveyJson = {
      keyExperience: '支教一年',
      identity: {
        displayName: '林溪',
        preferredAddress: '林溪',
        genderIdentity: 'female',
        ageBand: '23-27',
        hometownCity: '成都',
        currentCity: '上海',
        education: 'bachelor',
        occupation: '设计师',
        industry: '互联网',
        workDescription: '做交互设计',
        keyLifeExperiences: ['创业失败', '独自旅行'],
        selfIntroOneLiner: '一个爱折腾的人',
      },
    };

    const text = buildTextForEmbedding(
      { displayName: '林溪', bioJson: survey },
      survey,
      userId,
    );

    expect(text).toContain('关键经历:创业失败；独自旅行');
    expect(text).not.toContain('关键经历:支教一年');
  });

  it('falls back to old keyExperience when identity.keyLifeExperiences is absent', () => {
    const survey: OnboardingSurveyJson = {
      keyExperience: '支教一年',
    };

    const text = buildTextForEmbedding(
      { displayName: '测试', bioJson: survey },
      survey,
      userId,
    );

    expect(text).toContain('关键经历:支教一年');
  });
});
