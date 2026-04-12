---
description: Thuần hóa và tích hợp an toàn GitNexus vào kiến trúc Antigravity
---
# /gitnexus-update

Chạy `GitNexus Analyze` an toàn: không tạo `.claude`, tự giữ embeddings nếu đã có.

## Bước thực hiện

1. **Kiểm tra trạng thái trước khi chạy** (không bắt buộc nhưng nên làm)
   // turbo
   `node .agent/scripts/gitnexus-sync.js --status-only`
   Sẽ log: số embeddings hiện tại + các file legacy nếu còn sót.

2. **Chạy sync (tự detect embeddings)**
   // turbo
   `node .agent/scripts/gitnexus-sync.js`
   Script sẽ:
   - Đọc `.gitnexus/meta.json` → nếu `embeddings > 0` thì tự thêm `--embeddings` flag
   - Chạy `npx gitnexus analyze` (hoặc `--embeddings`)
   - Xóa `.claude/` và `CLAUDE.md` nếu GitNexus tái tạo chúng
   - In ra kết quả: Symbols / Relationships / Embeddings preserved

3. **Done.** Output mẫu khi thành công:
   ```
   [gitnexus-sync] ✅ Done.
     Symbols:       10036
     Relationships: 24830
     Embeddings:    512 (preserved: true)
   ```

## Khi nào cần chạy

- Sau khi commit code mới (ít nhất mỗi cuối sprint)
- Khi GitNexus báo index stale
- Sau khi thêm file/module mới vào monorepo
