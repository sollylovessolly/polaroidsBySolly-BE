import { Injectable } from '@nestjs/common';

@Injectable()
export class PhoneNumberService {
  normalizeNigerian(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 11) {
      return `+234${digits.slice(1)}`;
    }
    return phone.trim();
  }

  lookupCandidates(phone: string) {
    const normalized = this.normalizeNigerian(phone);
    const candidates = new Set([phone.trim(), normalized]);
    if (normalized.startsWith('+234')) {
      candidates.add(`0${normalized.slice(4)}`);
      candidates.add(normalized.slice(1));
    }
    return [...candidates];
  }
}
