/**
 * Фото продукції — по одному на кожну з 18 позицій асортименту.
 *
 * Джерело: тека «Listex 06_2026 лише фото SKU» на Google Drive. Ключ —
 * id позиції з `data/skus.ts`, тому нову позицію без фото видно одразу:
 * у каталозі на її місці лишиться силует.
 */
export const SKU_PHOTOS: Record<number, string> = {
  // 0,5 л ПЕТ
  1: '1N13xwwKKBej-nu0UckhgefTE0h3Rw16r', // негазована
  2: '1gXi0rU4YDif4U1Ys6qNjl9TRPK9phgxK', // слабогазована
  3: '1IyxSRNjRAFOB6v0jb96SmfwCq4SAp9aF', // сильногазована
  // 0,75 л ПЕТ
  4: '1qYRNcfIKCsqqwlKKdyojXrvns2Y1JwsN',
  5: '1UooNIzqe6hEK1RqsGZGGbwKsLKanYFsv',
  6: '1dJFBlPNKzTfuHBqvVzopgbTQy5kf8d7S',
  // 0,75 л ПЕТ SPORT
  7: '19z5RTGptOs5pxqX86CUu8k3jhV0gmMTa',
  // 1,5 л ПЕТ
  8: '1SBbbwcNBxy3XWNWaYenI8je3JfugIuas',
  9: '1N3rfO2uiSV_AI27jE7EBmwYa9ThwlDcT',
  10: '1X4aFbEMckTEX8UqVVstdYflbCKZ9a9gh',
  // 2,0 л ПЕТ
  11: '1_a2OIocR-p0FLrqbE5tpegbY9FpW0dsQ',
  12: '18S2_hI59s1JBfiR25Uqpxx5W_c1-GXnY',
  13: '1Im-vWNetDOoXP4SfmMMauW6lYmQkDU5T',
  // 0,3 л скло
  14: '1eit4-Uh_Z6TPQRHL58kMz2LyysDPTYNA',
  15: '1URo8Ptdf3cV8kWO-5K9UNmATNKHt-rkJ',
  // 0,75 л скло
  16: '1rA91n0cV2Mtzdfn2M_3UTfaHdHTmqpz2',
  17: '1oQPMbhf1d8P9P8Bp1bEG6fPOMQdhdffO',
  // 7 л «Особлива»
  18: '1YHaWkHYCF8M3FkP8Igb9joeO9um1x8uk',
}
