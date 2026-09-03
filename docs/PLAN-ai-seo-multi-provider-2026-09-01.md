# AI SEO Generate — hỗ trợ nhiều provider — brief cho Codex (2026-09-01)

Context: nút "Generate with AI" (SEO title/focus keyphrase/meta description/social title/description) hiện chỉ dùng **Anthropic Claude** (`backend/app/Services/AiSeoGeneratorService.php`), và tài khoản Anthropic hiện hết credit nên tính năng đang không dùng được. User muốn mở rộng hỗ trợ nhiều provider (OpenAI/ChatGPT, xAI/Grok, Google/Gemini, giữ nguyên Anthropic) — **tự động dùng provider nào có API key được cấu hình**, không bắt buộc phải nạp tiền đúng 1 chỗ.

## Hiện trạng (đã audit)

- `AiSeoGeneratorService::generate()` — gọi thẳng Anthropic SDK (`anthropic-ai/sdk` qua Composer), dùng `outputConfig.format.json_schema` để ép JSON output đúng schema 5 field: `seo_title, focus_keyphrase, meta_description, social_title, social_description`.
- `apiKey()` đọc theo thứ tự: DB Setting (`Setting::get('anthropic_api_key')`, cache 300s) → fallback `config('services.anthropic.key')` (từ `.env` `ANTHROPIC_API_KEY`).
- **Không có UI admin nào để nhập `anthropic_api_key` vào Setting** — hiện chỉ set được qua `.env` trên VPS. Cần audit thêm khi làm: có Setting model page (Filament `SettingResource`) cho việc này chưa, hay cần thêm field mới.
- Controller: `App\Http\Controllers\Api\Admin\AiSeoController::generate()` — nhận `title/content/content_type`, gọi service, trả JSON hoặc 422 kèm message lỗi (dùng nguyên message exception, hiện tại là message billing của Anthropic).
- Route: `POST /admin/posts/generate-seo` (trong `routes/api.php`, admin group).
- Dùng ở: Post create/edit form trong `admin/` (Vite/React) — nút "Generate with AI".

## Yêu cầu thiết kế

1. **Kiến trúc provider-agnostic**: tạo interface (VD `App\Contracts\AiSeoProvider`) với method `generate(string $prompt): array` (trả đúng 5 field schema hiện có) hoặc tương đương. Từng provider implement riêng:
   - `AnthropicSeoProvider` — giữ nguyên logic hiện có (di chuyển từ `AiSeoGeneratorService`, không đổi behavior).
   - `OpenAiSeoProvider` — dùng Structured Outputs (`response_format: json_schema`), model đề xuất mặc định `gpt-4o` hoặc bản mới hơn tại thời điểm code (Codex tự kiểm tra model hiện hành, đừng hardcode model đã deprecated).
   - `GrokSeoProvider` (xAI) — API tương thích OpenAI (cùng SDK OpenAI-compatible, đổi `base_uri` sang endpoint xAI), model `grok` phù hợp — **verify đúng SDK/base URL/model name thật từ tài liệu xAI trước khi code, đừng đoán** (theo nguyên tắc "verify vendor API before use" đã áp dụng xuyên suốt dự án này).
   - `GeminiSeoProvider` (Google) — dùng Google Generative Language API, structured output qua `responseSchema`/`responseMimeType: application/json`. Kiểm tra có package PHP chính thức/cộng đồng ổn định chưa, hay gọi thẳng qua `Illuminate\Support\Facades\Http` REST call — Codex tự quyết định, ưu tiên cách ít phụ thuộc/ổn định hơn.
2. **`AiSeoGeneratorService` trở thành resolver**: tự phát hiện provider nào có key hợp lệ (không rỗng) — thứ tự ưu tiên mặc định: Anthropic → OpenAI → Grok → Gemini (giữ nguyên hành vi cũ nếu chỉ Anthropic có key, không phá tính năng đang có). Cho phép override thứ tự/ép chọn cụ thể qua 1 Setting mới (VD `ai_seo_provider` = `anthropic|openai|grok|gemini|auto`, mặc định `auto`).
3. **Cấu hình key**: mỗi provider đọc key theo đúng pattern hiện có của Anthropic (Setting DB trước, fallback `.env`) — thêm `openai_api_key`, `xai_api_key`, `gemini_api_key` (tên field do Codex đặt nhất quán) vào cùng cơ chế `Setting::get()` + cache.
4. **UI admin**: audit xem `SettingResource` (Filament, port 8000) hiện có trang "AI Settings"/tương tự chưa; nếu chưa có UI nhập `anthropic_api_key` từ trước thì đây là lúc thêm luôn — 1 trang Settings có 4 field nhập key (password/masked input), hiển thị provider nào đang active (dựa vào key nào có sẵn), không cần đưa 4 field này sang admin/ React mới (Settings vẫn ở Filament, ngoài phạm vi Commerce migration đã làm các phiên trước).
5. **Lỗi/fallback**: nếu provider đang chọn (theo priority hoặc override) gọi API fail (hết quota/lỗi mạng/...), có nên tự động thử provider kế tiếp có key hay chỉ báo lỗi thẳng? Đề xuất: **thử provider kế tiếp có key** (resilience tốt hơn, đúng tinh thần "loại nào có thì dùng loại đó" user đã nói), nhưng log rõ provider nào fail + lý do để dễ debug, và message lỗi cuối cùng (khi tất cả provider đều fail hoặc không provider nào có key) phải rõ ràng — không lộ raw API error khó hiểu cho non-technical admin.
6. **Test**: Codex tự viết test cho resolver logic (chọn đúng provider theo key có sẵn, đúng thứ tự fallback, đúng behavior khi không provider nào có key) — mock từng provider client, không gọi API thật trong test.

## Không cần làm

- Không đổi contract/response shape của `POST /admin/posts/generate-seo` (vẫn 5 field JSON như cũ) — frontend `admin/` không cần đổi gì.
- Không cần cho phép chọn provider theo từng lần generate (per-request) — chỉ cấu hình ở Settings cấp hệ thống.
- Không cần UI hiển thị "provider nào vừa tạo ra kết quả này" trên post form — out of scope, chỉ cần log phía backend là đủ.

## Sau khi code xong

Báo lại để Claude review (đọc diff, verify provider resolver logic, kiểm tra không phá tính năng Anthropic hiện có) trước khi merge/deploy — theo đúng quy trình đã dùng cho Commerce migration.
