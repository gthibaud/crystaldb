import type { Value } from "../../types";
import type { DateValue } from "../date/types";

export interface DateRangeValue extends Value {
    start: DateValue;
    end: DateValue;
}
