export type Primitive = number | string | boolean | bigint | symbol | null | undefined;

export type BaseClass = new (...args: any[]) => any;

export type TraceKitStackFrame = {
  url: string;
  func: string;
  args: string[];
  line: number | null;
  column: number | null;
};

export type SentryStackFrame = {
  filename?: string;
  function?: string;
  module?: string;
  platform?: string;
  lineno?: number;
  colno?: number;
  abs_path?: string;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
  in_app?: boolean;
  instruction_addr?: string;
  addr_mode?: string;
  vars?: SimpleRecord;
};

export type TraceKitStackTrace = {
  name: string;
  message: string;
  mechanism?: string;
  stack: StackFrame[];
  failed?: boolean;
};

export type SdkInfo = {
  name: string;
  version: string;
  integrations?: string[];
  packages?: any[];
};

export type SentryException = {
  type?: string;
  value?: string;
  mechanism?: any;
  module?: string;
  thread_id?: number;
  stacktrace?: any;
};

export type SentryEvent = {
  event_id?: string;
  message?: string;
  timestamp?: number;
  level?: string;
  platform?: string;
  environment?: string;
  sdk?: SdkInfo;
  request?: Record<string, unknown>;
  exception?: {
    values?: SentryException[];
  };
  transaction?: string;
  stacktrace?: any;
  tags?: SimpleRecord;
  extra?: SimpleRecord;
  user?: SimpleRecord;
  type?: string;
};

export type SentryEventException = Omit<SentryEvent, 'exception'> & {
  exception: {
    values: SentryException[];
  };
};

export type StackFrame = {
  url: string;
  func: string;
  args: string[];
  line: number | null;
  column: number | null;
};

export type StackTrace = {
  name: string;
  message: string;
  mechanism?: string;
  stack: StackFrame[];
  failed?: boolean;
};

export type ExtendedError = Error & SimpleRecord;

export type SimpleRecord = Record<string, any>;

export type SimpleNode = {
  parentNode: SimpleNode;
} | null;

export type SimpleEvent = {
  [key: string]: unknown;
  type: string;
  target?: unknown;
  currentTarget?: unknown;
};

export type DispatchEvent = (event: SentryEvent) => void;

export type AnyFunction = (...args: any[]) => any;
