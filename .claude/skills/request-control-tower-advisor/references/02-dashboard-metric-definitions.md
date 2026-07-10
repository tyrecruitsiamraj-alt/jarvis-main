# Dashboard Metric Definitions

Use these Thai labels consistently:

| Thai label        | Meaning                      |
| ----------------- | ---------------------------- |
| ขอมา              | requested positions          |
| หาได้แล้ว         | fulfilled/informed positions |
| ปิดครบใบขอ        | fully fulfilled requests     |
| ยกเลิก            | cancelled positions          |
| จบงานแล้ว         | resolved requests            |
| เหลือหา           | remaining positions          |
| งานค้าง / ยอดยกมา | backlog                      |
| หาได้บางส่วน      | partial fulfillment          |

Do not use “ปิดได้” as the primary KPI label because it can be confused with “ปิดครบใบขอ”.

Use “หาได้แล้ว” for fulfilled/informed positions.

Use “ปิดครบใบขอ” only when fulfilledPositions >= requestPositions.

Use “จบงานแล้ว” when remainingPositions = 0, whether due to full fulfillment or cancellation.

Core equation:
startingBacklogPositions + newRequestPositions - fulfilledPositionsThisPeriod - cancelledPositionsThisPeriod = endingBacklogPositions

Thai:
ยอดค้างต้นงวด + ขอใหม่ - หาได้แล้ว - ยกเลิก = เหลือหา
