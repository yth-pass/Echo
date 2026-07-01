/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IsOptional, IsObject, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  displayName?: string;

  @IsOptional()
  @IsObject()
  matchPrefs?: {
    preferredGender?: string;
    preferredAgeBand?: string[];
    preferredCity?: string;
    preferredOccupation?: string[];
    relationshipIntent?: string;
  };

  @IsOptional()
  @IsObject()
  privacy?: {
    hideOnlineStatus?: boolean;
    hideFromDiscovery?: boolean;
    showReadReceipts?: boolean;
    autoMatchEnabled?: boolean;
  };

  @IsOptional()
  @IsObject()
  identity?: Record<string, unknown>;
}
