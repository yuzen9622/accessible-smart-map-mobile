import ExpoModulesCore
import UIKit

/// react-native-screens 的 formSheet 只在第一次出現時套用 `sheetInitialDetentIndex`，之後沒有 API 能從 JS 換 detent。
/// 這裡找到 App 常駐的地圖 sheet（多個 detent 的 UISheetPresentationController），以動畫切到指定 detent。
/// RNScreens 自訂 detent 的 identifier 是索引字串（"0"、"1"…），見 `RNSScreen.mm` `detentsFromValues`。
/// 程式切換不會觸發 UIKit delegate，因此 RNScreens 不會發 `sheetDetentChange`；呼叫端要自己同步狀態。
public class SheetDetentModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SheetDetent")

    /// 回傳是否真的換了 detent（找不到 sheet、索引超出範圍或已在該 detent 時回傳 false）。
    AsyncFunction("select") { (index: Int) -> Bool in
      guard let sheet = Self.findPersistentSheet() else { return false }
      let identifier = UISheetPresentationController.Detent.Identifier(String(index))
      guard sheet.detents.contains(where: { $0.identifier == identifier }) else { return false }
      if sheet.selectedDetentIdentifier == identifier { return false }
      sheet.animateChanges {
        sheet.selectedDetentIdentifier = identifier
      }
      return true
    }.runOnQueue(.main)
  }

  /// 沿著每個 window 的 presented 鏈找第一個有多個 detent 的 sheet（地圖 sheet）；
  /// 疊在上面的 modal（設定、登入）只有一個 large detent，會被略過。
  private static func findPersistentSheet() -> UISheetPresentationController? {
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
    for window in windows {
      var controller = window.rootViewController?.presentedViewController
      while let current = controller {
        if let sheet = current.sheetPresentationController, sheet.detents.count > 1 {
          return sheet
        }
        controller = current.presentedViewController
      }
    }
    return nil
  }
}
