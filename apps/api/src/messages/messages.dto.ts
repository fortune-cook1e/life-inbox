import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateMessageDto {
  @IsIn(["NEW_MATTER"])
  intent!: "NEW_MATTER";

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clientMessageId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  content!: string;
}

export class ListMessagesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;
}
