import { IsNotEmpty, IsString } from 'class-validator';

export class BootstrapTokenDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}
