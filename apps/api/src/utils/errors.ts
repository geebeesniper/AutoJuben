export class AppError extends Error {
  constructor(public status: number, message: string, public code = 'BAD_REQUEST') { super(message); }
}
export function assert(condition: unknown, message:string, status=400): asserts condition {
  if (!condition) throw new AppError(status,message);
}
export function publicMessage(error:unknown):string {
  return error instanceof AppError ? error.message : '服务暂时不可用，请稍后重试';
}
