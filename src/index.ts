const delay = async (delayMs: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, delayMs));

const outputTarget = document.querySelector("#output");

class JoyConHID {
  private globalPacketNumber = 0x00; // 0x0 ~ 0xf. see: https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering/blob/master/bluetooth_hid_notes.md#output-0x01

  constructor(private joyCon: HIDDevice) {}

  async sendCommand(
    subCommand: number,
    subCommandArguments: number
  ): Promise<void> {
    await this.joyCon.sendReport(
      0x01,
      this.createQuery(subCommand, subCommandArguments)
    );
  }

  /**
   * create JoyCon sendReport query
   * see: https://github.com/chromium/chromium/blob/ccd149af47315e4c6f2fc45d55be1b271f39062c/device/gamepad/nintendo_controller.cc#L1496
   */
  private createQuery(
    subCommand: number,
    subCommandArguments: number
  ): Uint8Array {
    const query = new Array(48).fill(0x00);
    query[0] = this.globalPacketNumber % 0x10; // 0x0 ~ 0xf
    query[1] = 0x00;
    query[2] = 0x01;
    query[5] = 0x00;
    query[6] = 0x01;
    query[9] = subCommand;
    query[10] = subCommandArguments;

    this.globalPacketNumber++;

    return Uint8Array.from(query);
  }
}

document.querySelector("#start-button")!.addEventListener("click", async () => {
  if (navigator.hid === undefined) {
    throw new Error("unsupported browser");
  }

  const devices = await navigator.hid.requestDevice({
    filters: [
      {
        vendorId: 0x057e
        // productId: 0x2007 // joy-con R
      }
    ]
  });
  const device = devices[0];

  device.addEventListener("inputreport", (event: HIDInputReportEvent) => {
    const data = JSON.stringify(event.data);
    if (data) {
      outputTarget!.innerHTML = data;
    }
  });

  await device.open();
  const joyCon = new JoyConHID(device);
  // 加速度センサーを有効にする
  // https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering/blob/master/bluetooth_hid_subcommands_notes.md#subcommand-0x40-enable-imu-6-axis-sensor
  await joyCon.sendCommand(0x40, 0x01);
  await delay(500); // 加速度センサーが有効になるまで少し時間がかかるので待つ
  // JoyCon の input report mode を 60Hz の Standard full mode にする
  // https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering/blob/master/bluetooth_hid_subcommands_notes.md#subcommand-0x03-set-input-report-mode
  await joyCon.sendCommand(0x03, 0x30);
});
