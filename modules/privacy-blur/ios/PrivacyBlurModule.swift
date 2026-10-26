import CoreImage
import ExpoModulesCore
import Vision

/// Pixela caras y siluetas en el teléfono, antes de que la foto salga hacia la IA.
/// Vision solo devuelve rectángulos (no identidades), y la foto original no se modifica.
@ExpoModule("PrivacyBlur")
public class PrivacyBlurModule: Module {
  // El trabajo es de CPU y no toca la UI: `.concurrent` lo saca del hilo de JS.
  @JS(.concurrent)
  func pixelatePeople(uri: String) async throws -> PixelationResult {
    return try pixelate(uri: uri)
  }
}

@Record
struct PixelationResult {
  var uri: String = ""
  /// Cuántas caras o siluetas se ocultaron.
  var people: Int = 0
}

/// Margen alrededor de cada detección, para que no se asome el borde de una cara.
private let margin: CGFloat = 0.2

private func pixelate(uri: String) throws -> PixelationResult {
  guard let url = URL(string: uri),
    let image = CIImage(contentsOf: url, options: [.applyOrientationProperty: true])
  else {
    throw UnreadableImageException(uri)
  }

  let faces = VNDetectFaceRectanglesRequest()
  let bodies = VNDetectHumanRectanglesRequest()
  bodies.upperBodyOnly = false
  try VNImageRequestHandler(ciImage: image, options: [:]).perform([faces, bodies])
  let boxes = (faces.results ?? []).map(\.boundingBox) + (bodies.results ?? []).map(\.boundingBox)

  // Vision y Core Image usan coordenadas normalizadas con origen abajo a la izquierda.
  let extent = image.extent
  var output = image
  for box in boxes {
    let rect = CGRect(
      x: extent.minX + box.minX * extent.width,
      y: extent.minY + box.minY * extent.height,
      width: box.width * extent.width,
      height: box.height * extent.height
    )
    .insetBy(dx: -box.width * extent.width * margin, dy: -box.height * extent.height * margin)
    .intersection(extent)
    guard !rect.isNull, rect.width > 1, rect.height > 1 else { continue }

    let blockSize = max(max(rect.width, rect.height) / 8, 12)
    let pixelated = image.clampedToExtent()
      .applyingFilter(
        "CIPixellate",
        parameters: [
          kCIInputScaleKey: blockSize,
          kCIInputCenterKey: CIVector(x: rect.midX, y: rect.midY),
        ]
      )
      .cropped(to: rect)
    output = pixelated.composited(over: output)
  }

  guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
    let data = CIContext().jpegRepresentation(
      of: output.cropped(to: extent),
      colorSpace: colorSpace,
      options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.7]
    )
  else {
    throw EncodingException()
  }

  let destination = FileManager.default.temporaryDirectory
    .appendingPathComponent("privacy-\(UUID().uuidString).jpg")
  try data.write(to: destination)

  return PixelationResult(uri: destination.absoluteString, people: boxes.count)
}

private final class UnreadableImageException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "No se pudo leer la imagen: \(param)"
  }
}

private final class EncodingException: Exception, @unchecked Sendable {
  override var reason: String {
    "No se pudo guardar la imagen pixelada"
  }
}
