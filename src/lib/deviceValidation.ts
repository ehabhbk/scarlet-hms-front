const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const HOSTNAME = /^(?=.{1,100}$)[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/

/** Arabic validation message, or null when the device endpoint is valid. */
export function validateDeviceEndpoint(host: string, port: string, aeTitle?: string): string | null {
  const trimmedHost = host.trim()

  if (!trimmedHost) return 'أدخل عنوان IP أو اسم المضيف للجهاز'
  if (!IPV4.test(trimmedHost) && !HOSTNAME.test(trimmedHost)) return 'عنوان الجهاز غير صالح'

  if (!port) return 'أدخل منفذ الجهاز'
  const portNumber = Number(port)
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    return 'المنفذ يجب أن يكون بين 1 و 65535'
  }

  if (aeTitle !== undefined && aeTitle.trim() && !/^[A-Za-z0-9_-]{1,16}$/.test(aeTitle.trim())) {
    return 'AE Title يجب أن يكون 1 إلى 16 حرفاً لاتينياً أو رقماً أو _ أو -'
  }

  return null
}
