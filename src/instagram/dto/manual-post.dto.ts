import { IsOptional, IsString } from 'class-validator';

export class ManualPostDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  niche?: string;
}
