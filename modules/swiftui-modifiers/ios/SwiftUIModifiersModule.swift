import ExpoModulesCore
import ExpoUI
import SwiftUI

/// @expo/ui 的 `bold()` 沒有參數，只能「有／沒有」這個 modifier；但 modifier 陣列的長度或種類一變，
/// `applyModifiers` 串起來的 `AnyView` 底層型別就變，SwiftUI 會把整棵子樹砍掉重建（沒有過場動畫、
/// Toggle 動畫被截斷）。這裡補一個帶開關的版本，讓呼叫端永遠放同一個 modifier、只換值。
internal struct BoldActiveModifier: ViewModifier, Record {
  @Field var isActive: Bool = true

  func body(content: Content) -> some View {
    content.bold(isActive)
  }
}

public class SwiftUIModifiersModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SwiftUIModifiers")

    OnCreate {
      ViewModifierRegistry.register("boldActive") { params, appContext, _ in
        try BoldActiveModifier(from: params, appContext: appContext)
      }
    }

    OnDestroy {
      ViewModifierRegistry.unregister("boldActive")
    }
  }
}
