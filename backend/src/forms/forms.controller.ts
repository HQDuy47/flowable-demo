import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { RequestTypesService } from '../request-types/request-types.service.js';
import { FormSchemasService } from './form-schemas.service.js';

/** Lấy form theo formKey, mỗi cách lưu một endpoint để demo cạnh nhau. */
@Controller('api/forms')
export class FormsController {
  constructor(
    private readonly types: RequestTypesService,
    private readonly schemas: FormSchemasService,
  ) {}

  /**
   * Cách 1: form definition theo formKey (vd. "leaveRequest:1:start"), lấy nguyên từ form engine của Flowable
   * (form-api): key, name, fields (id, name, type, required, readOnly, options, params.rules, params.messages),
   * outcomes. Renderer tự viết ở frontend vẽ thẳng từ đây.
   */
  @Get(':formKey')
  async getForm(@Param('formKey') formKey: string) {
    const form = await this.types.formByKey(formKey);
    if (!form) throw new NotFoundException(`Form "${formKey}" was not found`);
    return form;
  }

  /** Cách 2: JSON Schema + uiSchema lưu theo formKey (vd. "leaveRequest:1:start") trong app.form_schemas, cho rjsf. */
  @Get(':formKey/json-schema')
  async getFormSchema(@Param('formKey') formKey: string) {
    const form = await this.schemas.get(formKey);
    if (!form) throw new NotFoundException(`JSON Schema "${formKey}" was not found`);
    return form;
  }
}
