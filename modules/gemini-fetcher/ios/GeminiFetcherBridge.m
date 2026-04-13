#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(GeminiFetcher, NSObject)

RCT_EXTERN_METHOD(fetch:(NSString *)urlString
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
