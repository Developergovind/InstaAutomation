import { IsOptional, IsUUID } from 'class-validator';

export class TriggerPostDto {
  @IsOptional()
  @IsUUID()
  trendId?: string;
}
