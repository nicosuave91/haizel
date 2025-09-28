declare module '@temporalio/workflow' {
  export interface WorkflowInfo {
    workflowId: string;
  }

  export function condition(predicate: () => boolean | Promise<boolean>): Promise<void>;
  export function setHandler(signal: string, handler: (...args: unknown[]) => void): void;
  export function workflowInfo(): WorkflowInfo;
  export function proxyActivities<TActivityTypes>(
    options: Record<string, unknown>,
  ): TActivityTypes;
}
