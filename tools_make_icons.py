#!/usr/bin/env python3
"""Gera os ícones PNG do app sem dependências externas."""
import zlib, struct, math

def png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y*w*3:(y+1)*w*3]) for y in range(h))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))
    open(path, 'wb').write(data)

def make(size, path):
    S = size
    px = bytearray(S * S * 3)
    cx = cy = S / 2.0
    # geometria do "circuito" desenhado no ícone
    rx, ry = S * 0.335, S * 0.255
    band = S * 0.105
    car_t = -0.55                      # posição do carro na oval (radianos)
    car_x, car_y = cx + rx * math.cos(car_t), cy + ry * math.sin(car_t)
    for y in range(S):
        for x in range(S):
            # fundo com leve degradê
            t = y / S
            r, g, b = int(28 + 14 * (1 - t)), int(33 + 16 * (1 - t)), int(42 + 18 * (1 - t))
            # cantos arredondados
            k = S * 0.22
            dx = max(abs(x - cx) - (cx - k), 0)
            dy = max(abs(y - cy) - (cy - k), 0)
            if math.hypot(dx, dy) > k:
                r = g = b = 0
            else:
                e = math.hypot((x - cx) / rx, (y - cy) / ry)
                inner = 1 - band / ((rx + ry) / 2)
                if inner < e < 1.0:
                    r, g, b = 92, 98, 108                      # asfalto
                    if e > 0.975 or e < inner + 0.03:
                        r, g, b = 216, 53, 43                  # zebra
                    # linha de chegada
                    ang = math.atan2((y - cy) / ry, (x - cx) / rx)
                    if abs(ang - math.pi / 2) < 0.10:
                        r = g = b = 238 if ((x // max(1, S // 22)) % 2) else 24
                # marca de pneu atrás do carro
                for i in range(1, 9):
                    a = car_t - i * 0.085
                    mxp, myp = cx + rx * math.cos(a), cy + ry * math.sin(a)
                    if math.hypot(x - mxp, y - myp) < S * 0.028:
                        r, g, b = int(r * 0.45), int(g * 0.45), int(b * 0.45)
                # carro
                if math.hypot((x - car_x), (y - car_y)) < S * 0.062:
                    r, g, b = 255, 209, 102
            o = (y * S + x) * 3
            px[o], px[o+1], px[o+2] = r, g, b
    png(path, S, S, px)
    print('gerado', path)

make(192, 'icons/icon-192.png')
make(512, 'icons/icon-512.png')
make(180, 'icons/apple-touch-icon.png')
