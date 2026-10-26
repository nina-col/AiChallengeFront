Pod::Spec.new do |s|
  s.name           = 'PrivacyBlur'
  s.version        = '1.0.0'
  s.summary        = 'Pixela caras y siluetas en el teléfono antes de enviar una foto.'
  s.description    = 'Usa Apple Vision y Core Image para que ninguna persona salga reconocible en la foto que SpaceEase manda a la IA.'
  s.license        = 'MIT'
  s.author         = 'Spy Family'
  s.homepage       = 'https://github.com/Quique2/AiChallenge'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/Quique2/AiChallenge.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'CoreImage'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
