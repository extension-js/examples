declare module 'sql.js/dist/sql-wasm-browser.js' {
  export interface QueryExecResult {
    columns: string[]
    values: Array<Array<string | number | Uint8Array | null>>
  }

  export interface Database {
    run(sql: string, params?: ReadonlyArray<string | number | null>): Database
    exec(sql: string): QueryExecResult[]
    export(): Uint8Array
    close(): void
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => Database
  }

  export interface InitSqlJsConfig {
    locateFile?: (filename: string, prefix: string) => string
  }

  export default function initSqlJs(
    config?: InitSqlJsConfig
  ): Promise<SqlJsStatic>
}
