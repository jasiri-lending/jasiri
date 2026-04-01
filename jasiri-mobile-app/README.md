# Jasiri RO Suite — Mobile App

A premium React Native / Expo mobile application for **Relationship Officers (ROs)** to handle customer registration, lead management, and loan applications in the field.

---

## 📱 Features

| Feature | Details |
|---|---|
| **Biometric Auth** | Fingerprint / Face ID via `expo-local-authentication` |
| **2-Step Login** | Email + Password → OTP email → Supabase JWT session |
| **Live Dashboard** | Animated stat cards: Customers, Leads, Loans, Conversion Rate |
| **Customer Registration** | 4-step wizard with GPS capture and ID photo capture |
| **GPS Tagging** | `expo-location` captures high-accuracy lat/lng for every address |
| **Camera / Document Upload** | `expo-image-picker` for passport & ID photo capture |
| **Leads Management** | Hot / Warm / Cold filters, one-tap Call & WhatsApp |
| **Pull-to-Refresh** | All list screens support live data refresh |

---

## 🏗️ Project Structure

```
jasiri-mobile-app/
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx      # Auth stack
│   │   ├── login.tsx        # Login screen
│   │   └── verify.tsx       # OTP verification screen
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab bar (Home, Customers, + New, Leads)
│   │   ├── index.tsx        # Dashboard (live stats + recent activity)
│   │   ├── customers.tsx    # Customer list with search
│   │   ├── new-customer.tsx # 4-step customer registration wizard
│   │   └── leads.tsx        # Lead management with status filters
│   └── _layout.tsx          # Root layout (AuthProvider + NativeWind)
├── hooks/
│   └── useAuth.tsx          # AuthProvider + biometric login context
├── services/
│   ├── apiClient.js         # Axios client with auto Supabase JWT
│   └── supabase.ts          # Supabase JS client (SecureStore adapter)
├── global.css               # NativeWind CSS
├── tailwind.config.js       # Jasiri brand colours
├── metro.config.js          # Metro + NativeWind pipeline
└── babel.config.js          # NativeWind Babel preset
```

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd jasiri/jasiri-mobile-app
npm install
```

### 2. Start the Dev Server

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your Android or iOS device.

### 3. Test on Android Emulator / iOS Simulator

```bash
npx expo start --android   # Android
npx expo start --ios       # iOS (macOS only)
```

---

## 🎨 Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#1E3A8A` | Navy Blue — actions, header |
| `accent` | `#10B981` | Emerald Green — success, CTA |
| `brand.btn` | `#586ab1` | Buttons |
| `highlight` | `#FACC15` | Gold — notification badges |
| `brand.surface` | `#E7F0FA` | Cards / backgrounds |

---

## 🔌 Backend API (Jasiri Server)

All RO mobile endpoints are mounted at `/api/ro/*` and require a Bearer Supabase JWT.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ro/dashboard-stats` | RO summary stats + recent activity |
| `GET` | `/api/ro/customers` | Paginated customer list |
| `POST` | `/api/ro/customers/register` | Register new customer with GPS |
| `GET` | `/api/ro/leads` | Lead list for this RO |
| `PATCH` | `/api/ro/leads/:id` | Update lead status |

---

## 📋 Permissions Required (on first launch)

- **Camera** — ID & passport photo capture
- **Location** — GPS address tagging
- **Face ID / Fingerprint** — Biometric login
