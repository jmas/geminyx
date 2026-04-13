require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'GeminiFetcher'
  s.version        = package['version']
  s.summary        = 'Native Gemini protocol client for React Native'
  s.description    = 'Native Gemini protocol client for React Native'
  s.license        = 'MIT'
  s.author         = 'geminyx'
  s.homepage       = 'https://github.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '.', :tag => "v#{s.version}" }
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.swift_version  = '5.9'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  if defined?(install_modules_dependencies()) != nil
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
  end
end
