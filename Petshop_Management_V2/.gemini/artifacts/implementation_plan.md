# Goal Description

The user wants to redesign the UI (specifically the Sidebar layout and Settings Page) to strictly match the provided image of the old version/design mockup. The goal is to adopt the high-end, clean, high-contrast aesthetic seen in the image, instead of the current bloated or divergent "Liquid Glass" approach. We will utilize `@/ui-ux-pro-max` guidelines for premium visuals, creating a breathtaking exact match of the reference design.

## User Review Required

> [!IMPORTANT]
> - The new sidebar will adopt the exact groups seen in the image: **HOẠT ĐỘNG** and **QUẢN LÝ**.
> - The current complex gradient blobs in the background will be removed or toned down to match the clean solid dark aesthetic `#0B1120` shown in the reference image.
> - Please confirm if there are any additional sub-menus or missing elements that are not fully visible in the sidebar screenshot.

## Proposed Changes

---

### UI Modernization & Theming

- Refine CSS Variables to use solid, deeply saturated dark colors for `background-base` (e.g., `#0B1120`) instead of noisy gradients.
- Ensure the active cyan color `primary-500` matches exactly `#06b6d4` as seen in the active states.
- Clean up borders to use subtle `border-white/5` overlays for a very premium, minimalist feel.

#### [MODIFY] `globals.css`
- Update `--color-background-base` and component utilities to prioritize a flat, high-contrast dark aesthetic that matches the old design.
- Remove distractive elements, implementing modern minimalist rules from `/ui-ux-pro-max`.

---

### Sidebar Layout Restructuring

The sidebar needs to match exactly the items and groups shown in the reference image. The User Profile badge needs to move to the bottom left.

#### [MODIFY] `components/layout/sidebar.tsx`
- Implement Groups in navigation:
    - **Top items**: Tổng quan, Tạo đơn hàng.
    - **HOẠT ĐỘNG**: SPA & Grooming, Pet Hotel, Đơn hàng, Sổ quỹ, Báo cáo.
    - **QUẢN LÝ**: Sản Phẩm, Nhập hàng, Khách hàng, Thú cưng, Nhân viên, Ca làm việc.
- Move the "Cài đặt" option to the bottom anchored area.
- Add the User Profile (Quản trị viên @admin) below the settings link at the bottom.
- Adjust widths, text sizes (sm, xs for headers), and padding to match the clean aesthetic.

---

### Settings Page Pixel-Perfect Match

The target Settings Page in the image has a specific block layout for Theme settings.

#### [MODIFY] `app/(dashboard)/settings/page.tsx`
- **Left Panel (internal settings nav)**: Make the list background darker `bg-black/20`, ensure text is muted until hovered/active. Match border radii.
- **Main Panel**: Use a card `border` wrapper instead of floating glassy elements. 
- **Dark Mode Toggle**: Precisely match the elongated toggle pill for moon/sun tracking.
- **Color Palettes**: Replicate the perfect 4-column grid of color toggles with exact border aesthetics.
- Ensure the "Lưu cài đặt" button is aligned bottom-right.

## Open Questions

> [!WARNING]
> Is the "Light Mode" design available as a reference, or should I craft it seamlessly using standard UI contrasts based on the Dark Mode image? If not provided, I will construct a beautifully soft light theme.

## Verification Plan

### Manual Verification
- I will start the Dev Server, take screenshots of the new interface using the browser subagent, and ensure the UI matches the reference image conceptually and geometrically.
