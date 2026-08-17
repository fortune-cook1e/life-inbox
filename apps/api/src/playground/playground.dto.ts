import { IsNotEmpty, IsString } from "class-validator";

export class SearchQueryDto {
  @IsString()
  @IsNotEmpty()
  query!: string;
}
