/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, queryOne, getSql } from './db';
import { neon } from '@neondatabase/serverless';
import type { NeonQueryFunction } from '@neondatabase/serverless';

export { query, queryOne };

const _fkCache = new Map<string, { column: string; onParent: boolean } | null>();
const _tableColCache = new Map<string, string[]>();

async function getTableColumns(table: string): Promise<string[]> {
  if (_tableColCache.has(table)) return _tableColCache.get(table)!;
  const cols = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  const colNames = (cols.rows || []).map(r => r.column_name);
  _tableColCache.set(table, colNames);
  return colNames;
}

async function resolveFk(parentTable: string, childTable: string, childAlias: string): Promise<{ column: string; onParent: boolean } | null> {
  const cacheKey = `${parentTable}:{${childTable}:${childAlias}}`;
  if (_fkCache.has(cacheKey)) return _fkCache.get(cacheKey)!;

  const parentFk = `${childAlias}_id`;
  const singular = parentTable.replace(/s$/, '');
  const childFk = `${singular}_id`;

  const cols = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name IN ($2, $3)`,
    [childTable, parentFk, childFk]
  );

  let result: { column: string; onParent: boolean } | null = null;
  for (const row of cols.rows || []) {
    if (row.column_name === childFk) { result = { column: childFk, onParent: false }; break; }
    if (row.column_name === parentFk) { result = { column: parentFk, onParent: true }; break; }
  }

  if (!result) {
    const parentCols = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [parentTable, parentFk]
    );
    if (parentCols.rows?.length > 0) {
      result = { column: parentFk, onParent: true };
    } else {
      result = { column: childFk, onParent: false };
    }
  }

  _fkCache.set(cacheKey, result);
  return result;
}

export type SupabaseError = { message: string; code?: string; details?: string; hint?: string };
export type SupabaseResult<T> = { data: T | null; error: SupabaseError | null };
export type SupabaseListResult<T> = { data: T[] | null; error: SupabaseError | null; count?: number | null };

export function makeError(message: string, code?: string): SupabaseError {
  return { message, code, details: '', hint: '' };
}

type FilterOperator =
  | '=' | '!=' | '>' | '>=' | '<' | '<='
  | 'LIKE' | 'ILIKE' | 'IN';

interface FilterCond {
  column: string;
  operator: FilterOperator;
  value: any;
  logic: 'and' | 'or';
}

interface OrderCond { column: string; ascending: boolean; }
interface NestedSelect {
  alias: string;
  table: string;
  joinType: 'inner' | 'left';
  columns: string[];
}

export interface QuerySpec {
  tableName: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | 'rpc';
  selectColumns: string | null;
  selectOpts: { count?: 'exact' | null; head?: boolean } | null;
  insertData: Record<string, any> | Record<string, any>[] | null;
  updateData: Record<string, any> | null;
  upsertData: Record<string, any> | Record<string, any>[] | null;
  upsertOpts: { onConflict?: string };
  filters: FilterCond[];
  order: OrderCond[];
  limit: number | null;
  range: { start: number; end: number } | null;
  rpcName: string | null;
  rpcParams: Record<string, any>;
  single: boolean;
  maybeSingle: boolean;
}

function parseNestedSelects(selectStr: string): { mainColumns: string; nested: NestedSelect[] } {
  const nested: NestedSelect[] = [];
  const regex = /(\w+):(\w+)(!inner|!left)?\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(selectStr)) !== null) {
    const alias = match[1];
    const table = match[2];
    const joinType = match[3] === '!inner' ? 'inner' : 'left';
    const inner = match[4];
    nested.push({
      alias,
      table,
      joinType,
      columns: inner === '*' || !inner ? [] : inner.split(',').map(c => c.trim()).filter(Boolean),
    });
  }

  const main = selectStr.replace(regex, '').split(',').map(s => s.trim()).filter(Boolean).join(',') || '*';
  return { mainColumns: main, nested };
}

export class TableBuilder {
  private tableName: string;
  private _selectColumns: string | null = null;
  private _selectOpts: { count?: 'exact' | null; head?: boolean } | null = null;
  private _action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | 'rpc' = 'select';
  private _insertData: Record<string, any> | Record<string, any>[] | null = null;
  private _updateData: Record<string, any> | null = null;
  private _upsertData: Record<string, any> | Record<string, any>[] | null = null;
  private _upsertOpts: { onConflict?: string } = {};
  private _filters: FilterCond[] = [];
  private _order: OrderCond[] = [];
  private _limit: number | null = null;
  private _range: { start: number; end: number } | null = null;
  private _rpcName: string | null = null;
  private _rpcParams: Record<string, any> = {};
  private _single = false;
  private _maybeSingle = false;
  private _isBrowser: boolean;

  constructor(tableName: string, isBrowser = false) {
    this.tableName = tableName;
    this._isBrowser = isBrowser;
  }

  static fromSpec(spec: QuerySpec): TableBuilder {
    const builder = new TableBuilder(spec.tableName, false);
    if (spec.selectColumns !== null) builder._selectColumns = spec.selectColumns;
    if (spec.selectOpts !== null) builder._selectOpts = spec.selectOpts;
    builder._action = spec.action;
    if (spec.insertData !== null) builder._insertData = spec.insertData;
    if (spec.updateData !== null) builder._updateData = spec.updateData;
    if (spec.upsertData !== null) builder._upsertData = spec.upsertData;
    builder._upsertOpts = spec.upsertOpts;
    builder._filters = spec.filters;
    builder._order = spec.order;
    builder._limit = spec.limit;
    builder._range = spec.range;
    builder._rpcName = spec.rpcName;
    builder._rpcParams = spec.rpcParams;
    builder._single = spec.single;
    builder._maybeSingle = spec.maybeSingle;
    return builder;
  }

  toSpec(): QuerySpec {
    return {
      tableName: this.tableName,
      action: this._action,
      selectColumns: this._selectColumns,
      selectOpts: this._selectOpts,
      insertData: this._insertData,
      updateData: this._updateData,
      upsertData: this._upsertData,
      upsertOpts: this._upsertOpts,
      filters: this._filters,
      order: this._order,
      limit: this._limit,
      range: this._range,
      rpcName: this._rpcName,
      rpcParams: this._rpcParams,
      single: this._single,
      maybeSingle: this._maybeSingle,
    };
  }

  select(columns?: string, opts?: { count?: 'exact' | null; head?: boolean }): this {
    this._selectColumns = columns ?? '*';
    this._selectOpts = opts ?? null;
    return this;
  }

  insert(data: Record<string, any> | Record<string, any>[], _opts?: { onConflict?: string; count?: 'exact' }): this {
    this._action = 'insert';
    this._insertData = data;
    return this;
  }

  update(data: Record<string, any>): this {
    this._action = 'update';
    this._updateData = data;
    return this;
  }

  upsert(data: Record<string, any> | Record<string, any>[], opts?: { onConflict?: string }): this {
    this._action = 'upsert';
    this._upsertData = data;
    this._upsertOpts = opts ?? {};
    return this;
  }

  delete(): this {
    this._action = 'delete';
    return this;
  }

  rpc(name: string, params: Record<string, any>): this {
    this._action = 'rpc';
    this._rpcName = name;
    this._rpcParams = params;
    return this;
  }

  eq(column: string, value: any): this {
    this._filters.push({ column, operator: '=', value, logic: 'and' });
    return this;
  }

  neq(column: string, value: any): this {
    this._filters.push({ column, operator: '!=', value, logic: 'and' });
    return this;
  }

  gt(column: string, value: any): this {
    this._filters.push({ column, operator: '>', value, logic: 'and' });
    return this;
  }

  gte(column: string, value: any): this {
    this._filters.push({ column, operator: '>=', value, logic: 'and' });
    return this;
  }

  lt(column: string, value: any): this {
    this._filters.push({ column, operator: '<', value, logic: 'and' });
    return this;
  }

  lte(column: string, value: any): this {
    this._filters.push({ column, operator: '<=', value, logic: 'and' });
    return this;
  }

  like(column: string, pattern: string): this {
    this._filters.push({ column, operator: 'LIKE', value: pattern, logic: 'and' });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this._filters.push({ column, operator: 'ILIKE', value: pattern, logic: 'and' });
    return this;
  }

  in(column: string, values: any[]): this {
    this._filters.push({ column, operator: 'IN', value: values, logic: 'and' });
    return this;
  }

  or(queryStr: string): this {
    const conditions = queryStr.split(',').map(s => s.trim()).filter(Boolean);
    for (const cond of conditions) {
      const dotIdx = cond.indexOf('.');
      if (dotIdx === -1) continue;
      const column = cond.slice(0, dotIdx).trim();
      const rest = cond.slice(dotIdx + 1);
      const opMatch = rest.match(/^(ilike|like|eq|neq|gt|gte|lt|lte)\.(.+)$/);
      if (opMatch) {
        const opMap: Record<string, FilterOperator> = {
          ilike: 'ILIKE', like: 'LIKE', eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
        };
        const val = opMatch[2].replace(/^%/, '').replace(/%$/, '');
        this._filters.push({ column, operator: opMap[opMatch[1]], value: val, logic: 'or' });
      }
    }
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this._order.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(count: number): this {
    this._limit = count;
    return this;
  }

  range(start: number, end: number): this {
    this._range = { start, end };
    return this;
  }

  single(): Promise<SupabaseResult<any>> {
    this._single = true;
    return this.execute();
  }

  maybeSingle(): Promise<SupabaseResult<any>> {
    this._maybeSingle = true;
    return this.execute();
  }

  async selectAsync(): Promise<SupabaseListResult<any>> {
    this._selectColumns = this._selectColumns ?? '*';
    return this.execute() as Promise<SupabaseListResult<any>>;
  }

  then(resolve: (value: any) => any, reject?: (reason: any) => void): void | any {
    return this.execute().then(resolve, reject);
  }

  catch(reject: (reason: any) => void): any {
    return this.execute().catch(reject);
  }

  async execute(): Promise<SupabaseResult<any> | SupabaseListResult<any>> {
    try {
      if (this._isBrowser) {
        return await this.executeBrowser();
      }
      if (this._action === 'rpc') return await this.executeRpc();
      if (this._action === 'insert') return await this.executeInsert();
      if (this._action === 'update') return await this.executeUpdate();
      if (this._action === 'delete') return await this.executeDelete();
      if (this._action === 'upsert') return await this.executeUpsert();
      return await this.executeSelect();
    } catch (err: any) {
      return { data: null, error: makeError(err.message || 'Database error') };
    }
  }

  private async executeBrowser(): Promise<SupabaseResult<any> | SupabaseListResult<any>> {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(this.toSpec()),
    });

    const result = await res.json();
    if (!res.ok) {
      return { data: null, error: makeError(result.error || 'Request failed') };
    }
    return result;
  }

  private buildWhereClause(params: any[], startIdx: number): { clause: string; params: any[]; nextIdx: number } {
    const orFilters = this._filters.filter(f => f.logic === 'or');
    const andFilters = this._filters.filter(f => f.logic === 'and');
    const clauses: string[] = [];
    let idx = startIdx;
    const allParams = [...params];

    const escapeCol = (c: string) => `"${this.tableName}"."${c}"`;

    for (const f of andFilters) {
      if (f.operator === 'IN') {
        const placeholders = f.value.map((_: any, i: number) => `$${idx + i}`).join(', ');
        clauses.push(`${escapeCol(f.column)} IN (${placeholders})`);
        allParams.push(...f.value);
        idx += f.value.length;
      } else {
        clauses.push(`${escapeCol(f.column)} ${f.operator} $${idx}`);
        allParams.push(f.value);
        idx++;
      }
    }

    const orClauses: string[] = [];
    for (const f of orFilters) {
      if (f.operator === 'IN') {
        const placeholders = f.value.map((_: any, i: number) => `$${idx + i}`).join(', ');
        orClauses.push(`${escapeCol(f.column)} IN (${placeholders})`);
        allParams.push(...f.value);
        idx += f.value.length;
      } else {
        orClauses.push(`${escapeCol(f.column)} ${f.operator} $${idx}`);
        allParams.push(f.value);
        idx++;
      }
    }

    if (orClauses.length > 0) {
      clauses.push(`(${orClauses.join(' OR ')})`);
    }

    return { clause: clauses.join(' AND '), params: allParams, nextIdx: idx };
  }

  private async executeSelect(): Promise<SupabaseListResult<any>> {
    const selectStr = this._selectColumns ?? '*';
    const hasNested = /(\w+):(\w+)/.test(selectStr);

    if (hasNested) {
      return await this.executeNestedSelect(selectStr);
    }

    return await this.executeSimpleSelect(selectStr);
  }

  private async executeSimpleSelect(selectStr: string): Promise<SupabaseListResult<any>> {
    const countRequested = this._selectOpts?.count === 'exact';
    const headMode = !!this._selectOpts?.head;

    let selectPart: string;
    if (selectStr === '*' || selectStr === '') {
      selectPart = headMode ? '1' : '*';
    } else {
      const cols = selectStr.split(',').map(c => c.trim()).filter(Boolean);
      selectPart = cols.map(c => `"${c}"`).join(', ');
      if (headMode) selectPart = '1';
    }

    const params: any[] = [];
    const whereBuild = this.buildWhereClause(params, 1);

    let count: number | undefined;

    if (countRequested) {
      const countSql = `SELECT COUNT(*) as count FROM "${this.tableName}"${whereBuild.clause ? ` WHERE ${whereBuild.clause}` : ''}`;
      const countResult = await query(countSql, whereBuild.params);
      count = Number(countResult.rows[0]?.count || 0);
    }

    if (headMode) {
      return { data: null, error: null, count };
    }

    let sql = `SELECT ${selectPart} FROM "${this.tableName}"`;
    if (whereBuild.clause) sql += ` WHERE ${whereBuild.clause}`;

    for (const ord of this._order) {
      sql += ` ORDER BY "${ord.column}" ${ord.ascending ? 'ASC' : 'DESC'}`;
    }

    if (this._limit) sql += ` LIMIT ${this._limit}`;
    if (this._range) {
      const offset = this._range.start;
      const limit = this._range.end - this._range.start + 1;
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const result = await query(sql, whereBuild.params);
    const rows = result.rows || [];

    if (this._single) {
      if (rows.length === 0) return { data: null, error: makeError('Row not found', 'PGRST116'), count };
      return { data: rows[0], error: null, count };
    }

    if (this._maybeSingle) {
      return { data: rows[0] || null, error: null, count };
    }

    return { data: rows, error: null, count };
  }

  private async executeNestedSelect(selectStr: string): Promise<SupabaseListResult<any>> {
    const { mainColumns, nested } = parseNestedSelects(selectStr);
    const hasCount = this._selectOpts?.count === 'exact';
    const headMode = !!this._selectOpts?.head;

    const joinClauses: string[] = [];
    const joinAliases: string[] = [];
    const nestedInfos: { alias: string; columns: string[]; table: string; isArray: boolean }[] = [];

    for (const n of nested) {
      const joinType = n.joinType === 'inner' ? 'INNER' : 'LEFT';
      const fk = await resolveFk(this.tableName, n.table, n.alias);
      let onClause: string;
      const isArray = fk ? !fk.onParent : false;
      if (fk && fk.onParent) {
        onClause = `"${this.tableName}"."${fk.column}" = "${n.alias}"."id"`;
      } else if (fk) {
        onClause = `"${this.tableName}"."id" = "${n.alias}"."${fk.column}"`;
      } else {
        onClause = `"${this.tableName}"."${n.alias}_id" = "${n.alias}"."id"`;
      }
      joinClauses.push(`${joinType} JOIN "${n.table}" AS "${n.alias}" ON ${onClause}`);
      nestedInfos.push({
        alias: n.alias,
        columns: n.columns.length > 0 ? n.columns : [],
        table: n.table,
        isArray,
      });
      joinAliases.push(n.alias);
    }

    const joinClauseStr = joinClauses.join(' ');

    if (headMode && hasCount) {
      const params: any[] = [];
      const whereBuild = this.buildWhereClause(params, 1);
      let countSql = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
      if (joinClauseStr) countSql += ' ' + joinClauseStr;
      if (whereBuild.clause) countSql += ` WHERE ${whereBuild.clause}`;
      const cr = await query(countSql, whereBuild.params);
      return { data: null, error: null, count: Number(cr.rows[0]?.count || 0) };
    }

    const colSelects: string[] = [];
    const mainTableCols = await getTableColumns(this.tableName);
    const mainColSet = new Set(mainTableCols);
    if (mainColumns === '*' || mainColumns === '') {
      for (const col of mainTableCols) {
        colSelects.push(`"${this.tableName}"."${col}"`);
      }
    } else {
      mainColumns.split(',').forEach(c => {
        c = c.trim();
        if (c === '*') {
          for (const col of mainTableCols) {
            colSelects.push(`"${this.tableName}"."${col}"`);
          }
        } else if (c) {
          colSelects.push(`"${this.tableName}"."${c}"`);
        }
      });
    }

    for (const n of nested) {
      let cols: string[];
      if (n.columns.length > 0) {
        cols = n.columns;
      } else {
        const colRes = await query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [n.table]
        );
        cols = (colRes.rows || []).map(r => r.column_name);
      }
      cols.forEach(col => {
        const aliasCol = `${n.alias}_${col}`;
        if (mainColSet.has(aliasCol)) return;
        colSelects.push(`"${n.alias}"."${col}" AS "${aliasCol}"`);
      });
    }

    const params: any[] = [];
    const whereBuild = this.buildWhereClause(params, 1);

    let sql = `SELECT ${colSelects.join(', ')} FROM "${this.tableName}"`;
    if (joinClauseStr) sql += ` ${joinClauseStr}`;
    if (whereBuild.clause) sql += ` WHERE ${whereBuild.clause}`;

    for (const ord of this._order) {
      sql += ` ORDER BY "${this.tableName}"."${ord.column}" ${ord.ascending ? 'ASC' : 'DESC'}`;
    }
    if (this._limit) sql += ` LIMIT ${this._limit}`;
    if (this._range) {
      const offset = this._range.start;
      const limit = this._range.end - this._range.start + 1;
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    let count: number | undefined;
    if (hasCount) {
       const countSql = `SELECT COUNT(*) as count FROM "${this.tableName}" ${joinClauseStr}${whereBuild.clause ? ` WHERE ${whereBuild.clause}` : ''}`;
      const cr = await query(countSql, whereBuild.params);
      count = Number(cr.rows[0]?.count || 0);
    }

    const result = await query(sql, whereBuild.params);
    const rows = result.rows || [];

    const hasArrayRelation = nestedInfos.some(n => n.isArray);
    let transformedRows: any[];

    if (!hasArrayRelation) {
      transformedRows = rows.map(row => {
        const mainObj: any = {};
        const nestedData: Record<string, any> = {};

        for (const key of Object.keys(row)) {
          let matched = false;
          for (const na of joinAliases) {
            const prefix = `${na}_`;
            if (key.startsWith(prefix) && !mainColSet.has(key)) {
              const nestedKey = key.slice(prefix.length);
              if (!nestedData[na]) nestedData[na] = {};

              const info = nestedInfos.find(n => n.alias === na);
              if (info && info.columns.length > 0 && !info.columns.includes(nestedKey)) {
                matched = true;
                break;
              }
              nestedData[na][nestedKey] = row[key];
              matched = true;
              break;
            }
          }
          if (!matched) {
            mainObj[key] = row[key];
          }
        }

        for (const na of joinAliases) {
          const obj = nestedData[na];
          const allNull = !obj || Object.values(obj).every(v => v === null);
          mainObj[na] = allNull ? null : obj;
        }

        return mainObj;
      });
    } else {
      const groupedMap = new Map<string, { mainObj: any; arrayMap: Record<string, any[]> }>();

      for (const row of rows) {
        const mainObj: any = {};
        const nestedData: Record<string, any> = {};

        for (const key of Object.keys(row)) {
          let matched = false;
          for (const na of joinAliases) {
            const prefix = `${na}_`;
            if (key.startsWith(prefix) && !mainColSet.has(key)) {
              const nestedKey = key.slice(prefix.length);
              if (!nestedData[na]) nestedData[na] = {};

              const info = nestedInfos.find(n => n.alias === na);
              if (info && info.columns.length > 0 && !info.columns.includes(nestedKey)) {
                matched = true;
                break;
              }
              nestedData[na][nestedKey] = row[key];
              matched = true;
              break;
            }
          }
          if (!matched) {
            mainObj[key] = row[key];
          }
        }

        const parentKey = mainObj.id ?? JSON.stringify(mainObj);
        let entry = groupedMap.get(parentKey);
        if (!entry) {
          entry = {
            mainObj: { ...mainObj },
            arrayMap: {},
          };
          for (const info of nestedInfos) {
            if (info.isArray) {
              entry.arrayMap[info.alias] = [];
            } else {
              const obj = nestedData[info.alias];
              const allNull = !obj || Object.values(obj).every(v => v === null);
              entry.mainObj[info.alias] = allNull ? null : obj;
            }
          }
          groupedMap.set(parentKey, entry);
        }

        for (const info of nestedInfos) {
          if (info.isArray) {
            const item = nestedData[info.alias];
            const allNull = !item || Object.values(item).every(v => v === null);
            if (!allNull) {
              const existingList = entry.arrayMap[info.alias];
              const isDuplicate = item.id ? existingList.some(existing => existing.id === item.id) : false;
              if (!isDuplicate) {
                existingList.push(item);
              }
            }
          }
        }
      }

      transformedRows = Array.from(groupedMap.values()).map(entry => {
        for (const [alias, list] of Object.entries(entry.arrayMap)) {
          entry.mainObj[alias] = list;
        }
        return entry.mainObj;
      });
    }

    if (this._single) {
      if (transformedRows.length === 0) return { data: null, error: makeError('Row not found', 'PGRST116'), count };
      return { data: transformedRows[0], error: null, count };
    }

    if (this._maybeSingle) {
      return { data: transformedRows[0] || null, error: null, count };
    }

    return { data: transformedRows, error: null, count };
  }

   private fkColumn(alias: string): string {
    return `${alias}_id`;
   }

  private async executeInsert(): Promise<SupabaseResult<any>> {
    const data = this._insertData;
    if (!data) return { data: null, error: makeError('No data to insert') };

    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return { data: null, error: null };

    const columns = Object.keys(rows[0]);
    const placeholders = rows.map((_, i) =>
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
    ).join(', ');
    const allParams = rows.flatMap(row => columns.map(col => (col in row ? row[col] : null)));

    const sql = `INSERT INTO "${this.tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders} RETURNING *`;
    const result = await query(sql, allParams);
    const resultRows = result.rows || [];

    if (resultRows.length === 1) return { data: resultRows[0], error: null };
    if (resultRows.length > 1) return { data: resultRows, error: null };
    return { data: null, error: null };
  }

  private async executeUpdate(): Promise<SupabaseResult<any>> {
    if (!this._updateData) return { data: null, error: makeError('No data to update') };

    const columns = Object.keys(this._updateData);
    const setClause = columns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
    const params = columns.map(col => this._updateData![col]);
    const whereBuild = this.buildWhereClause(params, columns.length + 1);

    let sql = `UPDATE "${this.tableName}" SET ${setClause}`;
    if (whereBuild.clause) sql += ` WHERE ${whereBuild.clause}`;
    sql += ` RETURNING *`;

    const result = await query(sql, whereBuild.params);
    const resultRows = result.rows || [];

    if (this._single) return { data: resultRows[0] || null, error: null };
    if (this._maybeSingle) return { data: resultRows[0] || null, error: null };
    if (resultRows.length === 0) return { data: null, error: null };
    if (resultRows.length === 1) return { data: resultRows[0], error: null };
    return { data: resultRows, error: null };
  }

  private async executeDelete(): Promise<SupabaseResult<any>> {
    const params: any[] = [];
    const whereBuild = this.buildWhereClause(params, 1);

    let sql = `DELETE FROM "${this.tableName}"`;
    if (whereBuild.clause) sql += ` WHERE ${whereBuild.clause}`;
    sql += ` RETURNING *`;

    const result = await query(sql, whereBuild.params);
    const resultRows = result.rows || [];

    if (this._single) return { data: resultRows[0] || null, error: null };
    if (this._maybeSingle) return { data: resultRows[0] || null, error: null };
    if (resultRows.length === 0) return { data: null, error: null };
    if (resultRows.length === 1) return { data: resultRows[0], error: null };
    return { data: resultRows, error: null };
  }

  private async executeUpsert(): Promise<SupabaseResult<any>> {
    const data = this._upsertData;
    if (!data) return { data: null, error: makeError('No data to upsert') };

    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return { data: null, error: null };

    const allColumns = Object.keys(rows[0]);
    const conflictCol = this._upsertOpts.onConflict || 'id';
    const updateCols = allColumns.filter(c => c !== conflictCol);

    const placeholders = rows.map((_, i) =>
      `(${allColumns.map((_, j) => `$${i * allColumns.length + j + 1}`).join(', ')})`
    ).join(', ');
    const allParams = rows.flatMap(row => allColumns.map(col => (col in row ? row[col] : null)));

    let sql = `INSERT INTO "${this.tableName}" (${allColumns.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders} `;
    sql += `ON CONFLICT (${conflictCol}) DO UPDATE SET `;
    sql += updateCols.map((col, i) => `"${col}" = EXCLUDED."${col}"`).join(', ');
    sql += ` RETURNING *`;

    const result = await query(sql, allParams);
    const resultRows = result.rows || [];

    if (resultRows.length === 1) return { data: resultRows[0], error: null };
    if (resultRows.length > 1) return { data: resultRows, error: null };
    return { data: null, error: null };
  }

  private async executeRpc(): Promise<SupabaseResult<any>> {
    if (!this._rpcName) return { data: null, error: makeError('No RPC function specified') };

    const paramKeys = Object.keys(this._rpcParams);
    const paramPlaceholders = paramKeys.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `SELECT public."${this._rpcName}"(${paramPlaceholders}) as result`;
    const params = paramKeys.map(key => {
      const val = this._rpcParams[key];
      if (val === null || val === undefined) return null;
      if (Array.isArray(val)) return JSON.stringify(val);
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    });

    const result = await query(sql, params);
    const rows = result.rows || [];
    if (rows.length === 0) return { data: null, error: null };
    return { data: rows[0].result, error: null };
  }
}

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any> | null;
  app_metadata?: Record<string, any> | null;
  email_confirmed?: boolean;
  nom?: string;
  role?: string;
  telephone?: string | null;
  devise?: string | null;
  organization_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export class NeonClient {
  private isBrowser: boolean;
  private session: { user: AuthUser } | null = null;

  constructor(isBrowser = false) {
    this.isBrowser = isBrowser;
  }

  from(table: string): TableBuilder {
    return new TableBuilder(table, this.isBrowser);
  }

  rpc(name: string, params: Record<string, any>): TableBuilder {
    const builder = new TableBuilder('', this.isBrowser);
    builder.rpc(name, params);
    return builder;
  }

  async authGetUser(): Promise<{ data: { user: AuthUser | null }; error: null }> {
    if (this.isBrowser) {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        if (!res.ok) return { data: { user: null }, error: null };
        const json = await res.json();
        if (json.user) return { data: { user: json.user }, error: null };
        return { data: { user: null }, error: null };
      } catch {
        return { data: { user: null }, error: null };
      }
    }
    return { data: { user: null }, error: null };
  }
}
