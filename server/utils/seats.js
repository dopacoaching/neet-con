import Registration, { PAYMENT_STATUS } from '../models/Registration.js';

export const getSeatCapacity = () => Number(process.env.SEAT_CAPACITY || 600);

/**
 * Count seats that are actually filled (CONFIRMED or MANUAL).
 * @returns {Promise<number>}
 */
export const countConfirmedSeats = () =>
  Registration.countDocuments({
    paymentStatus: { $in: [PAYMENT_STATUS.CONFIRMED, PAYMENT_STATUS.MANUAL] },
  });

/**
 * Get a snapshot of seat availability.
 * @returns {Promise<{ confirmed:number, remaining:number, total:number, isFull:boolean }>}
 */
export const getSeatStats = async () => {
  const total = getSeatCapacity();
  const confirmed = await countConfirmedSeats();
  const remaining = Math.max(0, total - confirmed);
  return { confirmed, remaining, total, isFull: remaining <= 0 };
};
