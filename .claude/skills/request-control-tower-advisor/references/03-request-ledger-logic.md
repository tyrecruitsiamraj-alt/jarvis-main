# Request Ledger Logic

The dashboard must use ledger/event-based logic where possible.

Required conceptual ledgers:

1. Request Ledger
   Each request should include:

* requestNo
* submittedDate
* requiredDate
* effectiveRequestDate
* requestKind
* lifecycleKind
* requestActionName
* requestPositions
* unit/site/customer/owner fields
* SLA fields

2. Fulfillment Event Ledger
   Each event should include:

* requestNo
* eventDate
* eventType: informed or cancelled
* positionQty
* sourceTable
* isDateReliable
* reliabilityNote

Core calculation:
requestPositions = requested quantity
fulfilledPositions = informed/started/sent-to-start quantity
cancelledPositions = cancelled quantity
remainingPositions = max(requestPositions - fulfilledPositions - cancelledPositions, 0)

Status rules:

1. fulfilled 3 of 5, cancelled 0:

* หาได้แล้ว = 3
* เหลือหา = 2
* status = partial
* fully fulfilled = no
* resolved = no

2. fulfilled 5 of 5:

* หาได้แล้ว = 5
* เหลือหา = 0
* status = fully_fulfilled
* fully fulfilled = yes
* resolved = yes

3. fulfilled 2 of 5, cancelled 3:

* หาได้แล้ว = 2
* ยกเลิก = 3
* เหลือหา = 0
* status = partially_fulfilled_cancelled_remaining
* fully fulfilled = no
* resolved = yes

4. fulfilled 0 of 5, cancelled 5:

* หาได้แล้ว = 0
* ยกเลิก = 5
* เหลือหา = 0
* status = cancelled_full
* fully fulfilled = no
* resolved = yes

Effective request date:

* retroactive / ฉุกเฉินย้อนหลัง: use submitted/request date
* urgent / ฉุกเฉิน: use required/want date
* advance / ล่วงหน้า: use required/want date

Request kind classification:

* retroactive = required date < submitted date
* urgent = required date >= submitted date AND lead days < 7
* advance = lead days >= 7

Lifecycle mapping:

* resignation = request_action_name contains “ลาออก”
* replacement = request_action_name contains “เปลี่ยนตัว”
* increase_headcount = request_action_name contains “เพิ่มอัตรา”
* new_site = request_action_name contains “เปิดไซต์”
* other = anything else
