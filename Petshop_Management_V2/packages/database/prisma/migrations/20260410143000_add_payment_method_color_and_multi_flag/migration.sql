-- Alter payment methods to support display colors
CREATE TYPE "PaymentMethodColorKey" AS ENUM (
  'emerald',
  'sky',
  'amber',
  'orange',
  'violet',
  'rose',
  'cyan',
  'slate'
);

ALTER TABLE "payment_methods"
ADD COLUMN "colorKey" "PaymentMethodColorKey" NOT NULL DEFAULT 'emerald';

-- Persist payment behavior flags
ALTER TABLE "system_configs"
ADD COLUMN "allowMultiPayment" BOOLEAN NOT NULL DEFAULT false;
