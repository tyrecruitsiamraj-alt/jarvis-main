# SLA Rules

SLA rules:

* retroactive / ฉุกเฉินย้อนหลัง: 7 days from submitted/request date
* urgent / ฉุกเฉิน: 15 days from required/want date
* advance / ล่วงหน้า: 15 days from required/want date

SLA types:

1. Fulfillment SLA
   Measures how many positions were fulfilled within SLA.

2. Full Closure SLA
   Measures whether the whole request was fully fulfilled within SLA.
   This is the main executive SLA.

3. Resolution SLA
   Measures whether the request no longer has remaining positions due to fulfillment or cancellation.

Important:
Cancelled positions must not be counted as fully fulfilled.

SLA status:

* on_track
* at_risk
* breached
* fulfilled_on_time
* fully_closed_on_time
* resolved_on_time
* closed_late
* resolved_late

At risk:
Not breached and 0–3 days remaining.

Breached:
Today is later than slaDueDate and the request is not fully fulfilled/resolved depending on SLA type.
