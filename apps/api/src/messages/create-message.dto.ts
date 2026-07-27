import { IsIn, IsNotEmpty, IsString, MaxLength } from "class-validator";

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
