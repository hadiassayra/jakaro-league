export function isTransferMessage(event: Pick<MessageEvent, 'source' | 'origin' | 'data'>, source: Window | null, origin: string, type: string, nonce: string): boolean {
  return !!source && event.source === source && event.origin === origin && event.data?.type === type && event.data?.nonce === nonce;
}
