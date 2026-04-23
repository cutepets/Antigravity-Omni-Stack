// ===== CAGE COMMANDS =====
import { CreateCageHandler } from './commands/create-cage/create-cage.handler.js'
import { UpdateCageHandler } from './commands/update-cage/update-cage.handler.js'
import { DeleteCageHandler } from './commands/delete-cage/delete-cage.handler.js'
import { ReorderCagesHandler } from './commands/reorder-cages/reorder-cages.handler.js'

// ===== RATE TABLE COMMANDS =====
import { CreateRateTableHandler } from './commands/create-rate-table/create-rate-table.handler.js'
import { UpdateRateTableHandler } from './commands/update-rate-table/update-rate-table.handler.js'
import { DeleteRateTableHandler } from './commands/delete-rate-table/delete-rate-table.handler.js'

// ===== STAY COMMANDS =====
import { CreateStayHandler } from './commands/create-stay/create-stay.handler.js'
import { UpdateStayHandler } from './commands/update-stay/update-stay.handler.js'
import { UpdateStayPaymentHandler } from './commands/update-stay-payment/update-stay-payment.handler.js'
import { CheckoutStayHandler } from './commands/checkout-stay/checkout-stay.handler.js'
import { DeleteStayHandler } from './commands/delete-stay/delete-stay.handler.js'
import { CreateStayHealthLogHandler } from './commands/create-stay-health-log/create-stay-health-log.handler.js'
import { CreateStayNoteHandler } from './commands/create-stay-note/create-stay-note.handler.js'

// ===== CAGE QUERIES =====
import { FindAllCagesHandler } from './queries/find-all-cages/find-all-cages.handler.js'

// ===== RATE TABLE QUERIES =====
import { FindAllRateTablesHandler } from './queries/find-all-rate-tables/find-all-rate-tables.handler.js'
import { FindRateTableHandler } from './queries/find-rate-table/find-rate-table.handler.js'

// ===== STAY QUERIES =====
import { FindAllStaysHandler } from './queries/find-all-stays/find-all-stays.handler.js'
import { FindStayHandler } from './queries/find-stay/find-stay.handler.js'
import { FindStayTimelineHandler } from './queries/find-stay-timeline/find-stay-timeline.handler.js'
import { FindStayHealthLogsHandler } from './queries/find-stay-health-logs/find-stay-health-logs.handler.js'
import { CalculateHotelPriceHandler } from './queries/calculate-hotel-price/calculate-hotel-price.handler.js'

export const CommandHandlers = [
    CreateCageHandler, UpdateCageHandler, DeleteCageHandler, ReorderCagesHandler,
    CreateRateTableHandler, UpdateRateTableHandler, DeleteRateTableHandler,
    CreateStayHandler, UpdateStayHandler, UpdateStayPaymentHandler, CheckoutStayHandler, DeleteStayHandler,
    CreateStayHealthLogHandler, CreateStayNoteHandler,
]

export const QueryHandlers = [
    FindAllCagesHandler,
    FindAllRateTablesHandler, FindRateTableHandler,
    FindAllStaysHandler, FindStayHandler, FindStayTimelineHandler, FindStayHealthLogsHandler, CalculateHotelPriceHandler,
]
