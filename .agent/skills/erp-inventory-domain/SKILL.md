---
name: erp-inventory-domain
description: Enterprise Resouce Planning domain logic for Inventory Operations, Stocking, FIFO costing, Expiry Dates, and Auditing.
---

# ERP Inventory Domain Management

## Core Principles
1. **Cost Calculation**: Ensure stock valuations are strictly governed by FIFO (First In, First Out) or Weighted Average Cost. Inventory value directly impacts the PnL.
2. **Stock Movements (Journaling)**: Inventory levels must not be updated directly via overwriting rows. Use an event-sourced or ledger-based approach where every movement (IN, OUT, ADJUST, TRANSFER) is recorded as a transaction.
3. **Expiry & Batch Management**: Track batches and expiry dates for perishable items (e.g. Pet Food, Vaccines). The POS and fulfillment layers must strictly prevent allocation of expired goods.
4. **Safety Stock & Alerts**: Manage thresholds to automatically trigger low-stock alerts.
5. **Auditing & Locking**: During inventory counts, locations must be correctly frozen/locked to prevent concurrent operational discrepancies.
