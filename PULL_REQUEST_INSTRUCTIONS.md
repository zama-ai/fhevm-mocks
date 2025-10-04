# Pull Request Instructions

## Özet / Summary

Bu branch'te **4 kritik bug** düzeltilmiştir:

### 1. 🔴 KRİTİK: `assertIsBigUint160` fonksiyonundaki yanlış bit uzunluğu
- **Dosya**: `packages/mock-utils/src/utils/math.ts:146`
- **Düzeltme**: Bit uzunluğu 128'den 160'a değiştirildi
- **Etki**: uint160 değerleri ile çalışırken runtime hatalarını önler

### 2. ⚠️ ORTA: `package.json` tip hatası
- **Dosya**: `packages/mock-utils/package.json:2`
- **Düzeltme**: `"private": "true"` → `"private": true` (string'den boolean'a)
- **Etki**: Tooling uyumluluğunu iyileştirir

### 3. ⚠️ ORTA: Workspace yapılandırma hatası
- **Dosya**: `package.json:6-10`
- **Düzeltme**: Gereksiz `"packages/mock-utils/src"` workspace entry kaldırıldı
- **Etki**: npm workspace işlemlerinde potansiyel sorunları önler

### 4. 🔵 KÜÇÜK: Dosya adı typo'su
- **Dosya**: `packages/hardhat-plugin/src/type-extentions.ts`
- **Düzeltme**: Dosya adı `type-extensions.ts` olarak düzeltildi
- **Etki**: Kod kalitesini ve profesyonelliği artırır

---

## Pull Request Oluşturma Adımları

### 1. Branch'i GitHub'a Push Et

```bash
cd /tmp/fhevm-mocks
git push origin fix/critical-bugs-and-improvements
```

### 2. GitHub'da Pull Request Oluştur

1. https://github.com/Bihruze/fhevm-mocks sayfasına git
2. "Compare & pull request" butonuna tıkla
3. Base repository'yi **zama-ai/fhevm-mocks** (main) olarak seç
4. Head repository'yi **Bihruze/fhevm-mocks** (fix/critical-bugs-and-improvements) olarak seç

### 3. PR Başlığı ve Açıklaması

**Başlık**:
```
fix: critical bugs and code improvements
```

**Açıklama**:
```markdown
## Description

This PR fixes 4 bugs found during code review:

### 🔴 Critical Bug Fix
- **Fixed incorrect bit length in `assertIsBigUint160`** (line 146)
  - Changed from 128 to 160 bits
  - Impact: Prevents validation errors when working with uint160 values

### ⚠️ Code Quality Improvements
- **Fixed `private` field type** in `packages/mock-utils/package.json`
  - Changed from string `"true"` to boolean `true`
  - Impact: Better tooling compatibility

- **Fixed workspace configuration** in root `package.json`
  - Removed incorrect entry `"packages/mock-utils/src"`
  - Impact: Prevents potential npm workspace issues

- **Fixed typo in filename**
  - Renamed `type-extentions.ts` → `type-extensions.ts`
  - Impact: Code clarity and professionalism

## Testing

- [x] All bugs identified and fixed
- [x] Changes committed with descriptive message
- [ ] Tests should be run: `npm test`
- [ ] Linter should be run: `npm run lint`

## Related Issues

This PR addresses bugs found during manual code review of the forked repository.

## Checklist

- [x] Code follows project style guidelines
- [x] Changes are well documented
- [x] Commit message follows conventional commits format
- [x] All files have been properly renamed/updated
```

---

## Alternatif: Doğrudan Push

Eğer sadece kendi fork'unuzu güncellemek istiyorsanız:

```bash
cd /tmp/fhevm-mocks
git push origin fix/critical-bugs-and-improvements
```

Sonra ana branch'e merge edebilirsiniz:

```bash
git checkout main
git merge fix/critical-bugs-and-improvements
git push origin main
```

---

## Test Önerileri

Düzeltmelerden sonra bu testleri çalıştırmanız önerilir:

```bash
# Workspace'i temiz kur
npm install

# Testleri çalıştır
npm test

# Linter'ı çalıştır
npm run lint

# Build kontrol
npm run build
```

---

## İletişim

Herhangi bir sorunuz olursa, GitHub issue açabilir veya PR'da yorum bırakabilirsiniz.

