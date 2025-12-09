# Design Guidelines: BurnBot - Solana Token Burn Platform

## Design Approach

**Hybrid Fire-Themed Approach:** Landing page draws from bold, intense gaming/crypto aesthetics (Phantom, Uniswap) with fire/destruction visual language. Dashboard maintains utility-focused clarity with subtle ember accents.

**Key Principles:**
- Convey token destruction through visual heat and intensity
- Dark volcanic aesthetic with glowing ember effects
- Professional credibility despite bold visual theme
- Clear data hierarchy with fiery accent highlights

---

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary):**
- Background Base: 15 20% 6% (volcanic black)
- Surface: 15 18% 10% (charcoal)
- Surface Elevated: 15 15% 14% (ash)
- Border Subtle: 20 12% 18%
- Border: 20 10% 24%

**Brand Colors:**
- Primary (Molten Orange): 18 95% 55%
- Primary Glow: 18 100% 65%
- Secondary (Deep Red): 0 85% 48%
- Ember Accent: 35 100% 50% (bright orange)
- Success (Burn Complete): 142 76% 45%
- Warning: 45 92% 50%
- Error: 0 72% 55%

**Glow Effects:**
- Primary Glow: 18 100% 65% at 40% opacity
- Ember Glow: 35 100% 50% at 30% opacity
- Hot Spot: 25 100% 60% (transitional orange-yellow)

**Light Mode Toggle:**
- Background: 30 20% 95%
- Surface: 30 15% 98%
- Border: 20 10% 85%

### B. Typography

**Fonts (Google Fonts):**
- Primary: 'Inter' (700/600/500/400 weights)
- Display (Headlines): 'Syne' - bold, modern, geometric
- Mono: 'JetBrains Mono' (addresses/hashes)

**Scale:**
- Hero Display: 4rem (64px) / 800 / -0.03em
- Section Headline: 2.5rem (40px) / 700
- Dashboard Title: 2rem (32px) / 600
- Subsection: 1.5rem (24px) / 600
- Body Large: 1.125rem (18px) / 400
- Body: 1rem (16px) / 400
- Caption: 0.875rem (14px) / 500
- Mono: 0.875rem / 500

### C. Layout System

**Spacing Primitives:** Tailwind units 2, 4, 6, 8, 12, 16, 20, 24, 32
- Component internals: p-2, gap-2
- Cards/buttons: p-4, p-6, gap-4
- Section padding: py-16 md:py-24 lg:py-32
- Container: px-6 lg:px-8
- Major section gaps: gap-12, gap-16, gap-20

**Containers:**
- Landing: max-w-7xl
- Dashboard: max-w-[1600px]
- Text content: max-w-3xl

### D. Component Library

**Navigation:**
- Dark header with ember glow underline on active
- Logo with flame icon, navigation right, "Connect Wallet" with primary gradient
- Backdrop blur (backdrop-blur-xl bg-background/90)
- Mobile: slide-in overlay with flame border accent

**Buttons:**
- Primary: Molten orange gradient (18 95% 55% to 25 100% 60%) with glow shadow on hover
- Secondary: Ember outline with glow on hover
- Destructive (Burn Action): Deep red to orange gradient with intense glow
- Ghost: Transparent with ember text hover

**Cards:**
- Dashboard: Charcoal surface with subtle ember border-left accent on active
- Feature cards: Gradient border (orange to red) with hover glow effect
- Stats cards: Dark with glowing metric numbers in ember color
- Transaction cards: Compact with flame icon status indicators

**Forms:**
- Floating labels with ember focus ring
- Input backgrounds: Surface elevated
- Focus: Primary glow shadow (shadow-[0_0_20px_rgba(255,120,40,0.3)])
- Validation: Color-coded with ember success, red error

**Data Displays:**
- Transaction table: Subtle alternating rows with ember highlights for burns
- Status badges: Flame icon with colored backgrounds (burning/pending/complete)
- Charts: Minimal grid, bold ember data lines with glow
- Token amounts: Mono font with ember color for burned amounts
- Progress bars: Gradient fills with glowing edges

**Navigation Tabs:**
- Underline style with ember gradient animation
- Active state glows

**Overlays:**
- Modals: Centered with dark overlay and ember border glow
- Toasts: Top-right with flame icon, gradient border, auto-dismiss
- Wallet modal: Provider grid with hover glow states

### E. Animations

**Strategic Glow Effects:**
- Burn button: Pulsing ember glow on hover (animate-pulse subtle)
- Success animation: Flame burst on burn completion
- Card hover: Glow intensifies (shadow transition)
- Stats counters: Number increment with ember flash
- Active burns: Subtle flame flicker effect on status indicators
- Page transitions: Fade (200ms)
- Hero: Animated gradient shift on fire background

---

## Page-Specific Guidelines

### Landing Page

**Hero Section (85vh):**
- Large display headline: "BURN TOKENS. BUILD VALUE."
- Subheadline emphasizing automation and Solana speed
- Dual CTAs: "Start Burning" (molten gradient) + "View Pricing" (outline with blur background)
- Full-width background: Molten lava/flame imagery with dark overlay gradient for text contrast
- Floating ember particles animation (subtle)
- Trust bar below: "Automated • Audited • Transparent" with flame dividers

**Features (3-column grid on desktop):**
- Icons from Heroicons with ember glow
- Title + description cards with gradient borders
- Hover: Intensified glow and slight lift
- Features: Automated Burns, Real-time Monitoring, Treasury Management, Transparent History

**How It Works (4-step visual flow):**
- Numbered flame icons (1-4)
- Card layout with gradient connectors between steps
- Steps: Connect → Configure → Schedule → Monitor
- Alternating layout (zigzag) on desktop

**Burn Statistics Showcase:**
- Large animated counters in ember color
- 3-column: Total Tokens Burned, Total Value Destroyed, Active Projects
- Dark cards with glowing numbers
- Background: Subtle ember particles

**Pricing Tiers:**
- 3-tier layout: Starter, Pro, Enterprise
- Pro tier highlighted with flame badge and glow border
- Feature comparison with checkmarks
- "Get Started" CTAs with gradient

**Social Proof:**
- Transaction ticker: Live recent burns scrolling horizontally
- Format: "[Project] burned X tokens" with flame icons
- Testimonial cards with user avatars and ember accents

**Footer:**
- 4-column: Product, Resources, Company, Connect
- Newsletter signup with ember gradient CTA
- Social links with glow hover
- Bottom: Copyright, Solana logo, legal links

### Dashboard Application

**Sidebar:**
- Collapsed/expanded states with flame icon
- Navigation items with ember left border on active
- Icons: Heroicons with glow on hover
- Sections: Overview, Configure, History, Settings

**Configuration Panel:**
- Multi-step wizard with progress indicator (flame icons)
- Token contract input with validation glow
- Wallet addresses with copy buttons (ember flash on copy)
- Schedule visual selector with calendar/time picker
- Burn amount slider with ember fill
- Preview card showing next burn details
- "Activate Burns" button with gradient and glow

**Monitoring Dashboard:**
- Top metrics row (4 cards):
  - Next scheduled burn (countdown timer)
  - Total burned (lifetime)
  - Treasury balance
  - Last burn status (flame animation if active)
- Main area: Recent burns table with pagination
- Right panel: Active configuration summary with edit button
- Burn history chart with ember gradient area fill

**Transaction History:**
- Table columns: Timestamp, Type, Amount, Hash (truncated with copy), Status
- Status badges: flame icons with colors (burning/complete/failed)
- Click row: Expand details with Solscan link
- Filters: Date range, status, amount
- Export CSV with ember icon button

---

## Images

**Hero Image:** Full-width background featuring molten lava flows, ember particles, or abstract burning flames in deep oranges/reds. Dark gradient overlay for text readability. Image should evoke heat, energy, and destruction while maintaining professional quality.

**Feature Cards:** No images - use Heroicons with ember glow effects instead.

**Stats Section Background:** Subtle ember particle field or heat wave distortion effect as background layer.

**Dashboard:** No decorative images - data-focused with flame icon accents for status indicators.