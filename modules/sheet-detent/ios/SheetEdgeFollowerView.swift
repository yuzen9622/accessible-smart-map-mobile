import ExpoModulesCore
import UIKit

/// 讓 RN 內容貼在常駐地圖 sheet 的上緣，並在 sheet 拖曳、detent 動畫時逐格跟隨。
///
/// RN（Fabric）以 `center`／`bounds` 擺放本 view（見 `UIView+ComponentViewProtocol.mm`），不會覆寫
/// `transform`，所以這裡每個 display frame 讀 sheet 的 presentation layer（動畫與手勢中的實際位置），
/// 以 `transform` 把本 view 的底緣移到 sheet 上緣上方 `gap` pt。RN 端把它放在畫面底部（`bottom: 0`）。
/// sheet 高過半個畫面後淡出（全展開時地圖幾乎被蓋住，chips 沒有意義）。
final class SheetEdgeFollowerView: ExpoView {
  var gap: CGFloat = 4
  private var displayLink: CADisplayLink?

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      displayLink?.invalidate()
      displayLink = nil
    } else if displayLink == nil {
      let link = CADisplayLink(target: self, selector: #selector(step))
      link.add(to: .main, forMode: .common)
      displayLink = link
    }
  }

  @objc private func step() {
    guard let window, let superview else { return }
    guard let sheetView = SheetDetentModule.findPersistentSheet()?.presentedViewController.view else {
      alpha = 0
      return
    }
    // 以 presentation layer 換算：拖曳與 detent 動畫中讀到的是畫面上的實際位置（model layer 只有終點）
    let sheetLayer = sheetView.layer.presentation() ?? sheetView.layer
    let windowLayer = window.layer.presentation() ?? window.layer
    let sheetTop = sheetLayer.convert(sheetLayer.bounds, to: windowLayer).minY
    // 不含 transform 的底緣（center／bounds 是 RN 給的版面位置）
    let untransformedBottom = superview.convert(CGPoint(x: 0, y: center.y + bounds.height / 2), to: window).y
    let offset = min(0, sheetTop - gap - untransformedBottom)
    if transform.ty != offset {
      transform = CGAffineTransform(translationX: 0, y: offset)
    }
    // sheet 上緣在畫面 45%～30% 之間線性淡出（50% detent 時仍完全不透明）
    let height = window.bounds.height
    let fade = (sheetTop - height * 0.3) / (height * 0.15)
    alpha = max(0, min(1, fade))
  }
}
