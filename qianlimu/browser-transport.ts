/**
 * Browser Transport Layer for VCP
 * Enables VCP communication within a browser environment
 */

export interface VCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export type MessageHandler = (message: VCPMessage) => void;

export class BrowserTransport {
  private messageQueue: VCPMessage[] = [];
  private onMessageCallback: MessageHandler | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    this.isConnected = true;
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.messageQueue = [];
  }

  send(message: VCPMessage): void {
    if (!this.isConnected) {
      throw new Error('Transport not connected');
    }
    this.messageQueue.push(message);
  }

  onMessage(callback: MessageHandler): void {
    this.onMessageCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  receiveMessage(message: VCPMessage): void {
    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    } else {
      this.messageQueue.push(message);
    }
  }

  emitError(error: Error): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }
}

export class BidirectionalBrowserTransport {
  private clientTransport: BrowserTransport;
  private serverTransport: BrowserTransport;

  constructor() {
    this.clientTransport = new BrowserTransport();
    this.serverTransport = new BrowserTransport();

    const originalClientSend = this.clientTransport.send.bind(this.clientTransport);
    const originalServerSend = this.serverTransport.send.bind(this.serverTransport);

    this.clientTransport.send = (message: VCPMessage) => {
      originalClientSend(message);
      this.serverTransport.receiveMessage(message);
    };

    this.serverTransport.send = (message: VCPMessage) => {
      originalServerSend(message);
      this.clientTransport.receiveMessage(message);
    };
  }

  async connect(): Promise<void> {
    await this.clientTransport.connect();
    await this.serverTransport.connect();
  }

  async disconnect(): Promise<void> {
    await this.clientTransport.disconnect();
    await this.serverTransport.disconnect();
  }

  getClientTransport(): BrowserTransport {
    return this.clientTransport;
  }

  getServerTransport(): BrowserTransport {
    return this.serverTransport;
  }
}