import { Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe } from "@nestjs/common";

import { PublicApiException } from "../common/http/public-api.exception.js";
import { CasesService } from "./cases.service.js";

const caseIdPipe = new ParseUUIDPipe({
  version: "4",
  exceptionFactory: () =>
    new PublicApiException("caseId must be a valid UUID.", HttpStatus.BAD_REQUEST),
});

@Controller("cases")
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Delete(":caseId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCase(@Param("caseId", caseIdPipe) caseId: string) {
    await this.casesService.deleteCase(caseId);
  }
}
