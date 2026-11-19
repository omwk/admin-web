import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createServer } from 'node:net';

export async function smtp() {
  const messages = [];
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    let buffer = '';
    let data = false;
    let body = '';
    socket.write('220 localhost acceptance SMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n');
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        if (data) {
          if (line === '.') {
            messages.push(body);
            body = '';
            data = false;
            socket.write('250 accepted\r\n');
          } else body += line + '\n';
          continue;
        }
        if (/^EHLO|^HELO/i.test(line))
          socket.write('250-localhost\r\n250 8BITMIME\r\n');
        else if (/^DATA/i.test(line)) {
          data = true;
          socket.write('354 Send message\r\n');
        } else if (/^QUIT/i.test(line)) socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    count: () => messages.length,
    async verificationLink() {
      const expires = Date.now() + 30_000;
      while (Date.now() < expires) {
        for (const message of messages) {
          let decoded;
          if (/Content-Transfer-Encoding: base64/i.test(message))
            decoded = Buffer.from(
              message
                .split(/\r?\n\r?\n/)
                .slice(1)
                .join('\n')
                .trim(),
              'base64',
            ).toString();
          else if (/Content-Transfer-Encoding: quoted-printable/i.test(message))
            decoded = message
              .replace(/=\r?\n/g, '')
              .replace(/=([\dA-F]{2})/gi, (_, hex) =>
                String.fromCharCode(Number.parseInt(hex, 16)),
              );
          else decoded = message;
          const match = decoded.match(
            /https?:\/\/[^\s<>"']+\/auth\/email\/verify\?[^\s<>"']+#token=[\w-]+/,
          );
          if (match) return new URL(match[0].replaceAll('&amp;', '&'));
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      assert.fail(
        'The local SMTP sink did not receive an email verification link',
      );
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
