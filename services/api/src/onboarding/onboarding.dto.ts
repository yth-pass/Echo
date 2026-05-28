import { IsArray, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class StyleReplyDto {
  @IsString()
  scenarioId!: string;

  @IsString()
  choiceId!: string;

  @IsString()
  text!: string;
}

export class ValuesChoiceDto {
  @IsString()
  questionId!: string;

  @IsString()
  choiceId!: string;

  @IsString()
  label!: string;
}

export class SurveyDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsArray()
  interests?: string[];

  @IsOptional()
  @IsArray()
  styleReplies?: StyleReplyDto[];

  @IsOptional()
  @IsArray()
  toneTags?: string[];

  @IsOptional()
  @IsString()
  sampleMessage?: string;

  @IsOptional()
  @IsArray()
  valuesChoices?: ValuesChoiceDto[];

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}

export class DialogueStartDto {
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class DialogueTurnDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
