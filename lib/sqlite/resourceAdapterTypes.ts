import type {
  BaseRecord,
  CreateParams,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetOneParams,
  UpdateParams,
  UpdateResponse,
} from "@refinedev/core";

/** Per-resource handlers for the SQLite data provider. Omit methods the resource does not support. */
export type SqliteResourceAdapter = {
  getList?: <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ) => Promise<GetListResponse<TData>>;
  getOne?: <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ) => Promise<{ data: TData }>;
  create?: <TData extends BaseRecord = BaseRecord, TVariables = unknown>(
    params: CreateParams<TVariables>,
  ) => Promise<{ data: TData }>;
  update?: <TData extends BaseRecord = BaseRecord, TVariables = unknown>(
    params: UpdateParams<TVariables>,
  ) => Promise<UpdateResponse<TData>>;
  deleteOne?: <TData extends BaseRecord = BaseRecord, TVariables = unknown>(
    params: DeleteOneParams<TVariables>,
  ) => Promise<DeleteOneResponse<TData>>;
};
