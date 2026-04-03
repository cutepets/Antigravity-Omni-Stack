---
name: erp-hr-domain
description: ERP Domain Logic for Human Resources, Shift Scheduling, Commission Calculations, and Attribute-Based Access Control (ABAC).
---

# ERP HR Domain Management

## Core Principles
1. **Commission & Incentives**: Decouple sales transactions from employee earnings computationally. Build a ledger for commission calculation based on dynamic rule evaluations (e.g., specific services like VIP Grooming vs Standard grooming).
2. **Scheduling & Shifts**: Map employee schedules to availability. Tie booking/POS systems directly to staff shift constraints to prevent double-booking. Handles overlap logic.
3. **Attribute-Based Access Control (ABAC)**: Provide granular permissions based on user attributes (e.g., `role=manager` AND `shop_id=active_shop` AND `action=delete_bill` AND `time <= end_of_shift`).
4. **Separation of Duties**: Ensure cashiers cannot void their own transactions without higher-level approval logic or auditable logging.
