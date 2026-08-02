import { Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe } from "@nestjs/common";

import { CasesService } from "./cases.service.js";

@Controller("cases")
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Delete(":caseId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCase(@Param("caseId", new ParseUUIDPipe({ version: "4" })) caseId: string) {
    await this.casesService.deleteCase(caseId);
  }
}
