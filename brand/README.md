# Privateer — Brand Assets

The Privateer mark is a ship's anchor whose top ring is a **closed padlock** (with
keyhole) — "bring your own model" meets security and trust.

## Files

| File | Use |
|---|---|
| `privateer_logo.png` | **Official mark** — flat solid navy anchor + padlock on white |
| `privateer_navy_v1..v4.png` | Navy-on-white variants (`v1`, `v3` are alternates) |
| `privateer_logo_v1..v4.png` | Original cyan-on-dark variants |
| `icons/icon_{16…1024}.png` | App-icon / favicon sizes derived from the official mark |

## Colors

| Token | Hex | Use |
|---|---|---|
| Navy | `#1B3A5F` | primary mark on light backgrounds |
| Cyan | `#22D3EE` | accent / on-dark variant (matches the CLI theme) |

## Swapping the mark

To promote a different variant to the official mark and regenerate the icon set:

```bash
cd brand
cp privateer_navy_v1.png privateer_logo.png   # pick any variant
for s in 16 32 48 64 128 180 192 256 512 1024; do
  sips -z $s $s privateer_logo.png --out "icons/icon_${s}.png"
done
```

Logos were generated with Google Imagen 4.
