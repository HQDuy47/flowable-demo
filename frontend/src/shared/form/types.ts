/** Một trường trong form model của Flowable (file .form). */
export type Field = {
  id: string; name: string; type: string;
  required?: boolean; readOnly?: boolean; value?: any;
  options?: { name: string }[];
};

/** Form model của Flowable: các trường và (với form duyệt) các kết quả có thể chọn. */
export type FormModel = { name?: string; fields: Field[]; outcomes?: { id: string; name: string }[] };

export type FormValues = Record<string, any>;
