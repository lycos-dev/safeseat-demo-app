import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useUserPreferences } from "@/hooks/user-preferences-context";
import { useTheme } from "@/hooks/use-theme";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const STEPS = [
  ["1", "Choose seats", "Assign the driver and passengers to their actual seats."],
  ["2", "Confirm passenger consent", "Passengers must agree before monitoring. The signed-in Driver is ready automatically."],
  ["3", "Check SafeSeat", "The monitored seat must show Ready and SafeSeat must be online."],
  ["4", "Start Monitoring", "Use the fixed action at the bottom of Seats."],
];

export default function QuickHelp() {
  const { prototypeIndicator } = useUserPreferences();
  const themes=useTheme(); const styles=createStyles(themes); const insets=useSafeAreaInsets();
  const states=[
    ["NOT MONITORED","A person is assigned, but no sensor is linked",themes.textMuted],["CONSENT","This person must agree before monitoring",themes.lightOrange],["DECLINED","Monitoring was declined for this trip",themes.textMuted],["SAFE","No unusual signs detected for the monitored seat",themes.green],["WARNING","Check the person in that seat",themes.lightOrange],["EMERGENCY","Immediate attention may be needed",themes.warnBttn],["ANALYZING","SafeSeat is still checking",themes.info],["OFFLINE","Monitoring data is not available",themes.textMuted],
  ];
  return <SafeAreaView style={styles.screen} edges={["left","right","bottom"]}><ScrollView contentContainerStyle={[styles.content,{paddingBottom:90+insets.bottom}]} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Text style={styles.eyebrow}>QUICK HELP</Text><Text style={styles.title}>Using SafeSeat</Text></View>
    <Text style={styles.sectionLabel}>START A TRIP</Text><View style={styles.card}>{STEPS.map(([n,t,d],i)=><View key={n} style={[styles.stepRow,i<STEPS.length-1&&styles.divider]}><View style={styles.number}><Text style={styles.numberText}>{n}</Text></View><View style={{flex:1}}><Text style={styles.stepTitle}>{t}</Text><Text style={styles.stepDetail}>{d}</Text></View></View>)}</View>
    <Text style={styles.sectionLabel}>MONITORED SEAT</Text><View style={styles.cardCompact}><Text style={styles.stepTitle}>{prototypeIndicator ? "SafeSeat Sensor" : "Monitored seat"}</Text><Text style={styles.stepDetail}>{prototypeIndicator ? "In Seats, tap the SafeSeat Sensor card and choose the seat with the hardware." : "The selector is hidden. Enable Sensor setup card in Settings to change the sensor seat."} Only the linked, consenting seat receives live monitoring. Other seats remain unmonitored. Change Sensor setup card in Settings → System to show or hide the sensor selector.</Text></View>
    <Text style={styles.sectionLabel}>HOME AT A GLANCE</Text><View style={styles.cardCompact}><Text style={styles.stepDetail}>All five seats stay visible on Home. Tap a card for details. Safe applies only to the linked seat.</Text></View>
    <Text style={styles.sectionLabel}>STATUS GUIDE</Text><View style={styles.card}>{states.map(([l,d,c],i)=><View key={String(l)} style={[styles.stateRow,i<states.length-1&&styles.divider]}><View style={[styles.dot,{backgroundColor:String(c)}]}/><View style={{flex:1}}><Text style={[styles.stateLabel,{color:String(c)}]}>{l}</Text><Text style={styles.stepDetail}>{d}</Text></View></View>)}</View>
    <Text style={styles.sectionLabel}>DURING AN ALERT</Text><View style={styles.cardCompact}><Text style={styles.alertText}>Check the affected seat, review available heart-rate and breathing-rate indicators, and respond to the person’s condition. Passenger emergencies alert the driver; automated SMS is Driver-seat only.</Text></View>
  </ScrollView></SafeAreaView>
}
const createStyles=(t:ThemePalette)=>StyleSheet.create({screen:{flex:1,backgroundColor:t.background},content:{paddingHorizontal:spacing.two,paddingTop:38,gap:12},header:{marginBottom:8},eyebrow:{color:t.primaryBttn,fontSize:12,letterSpacing:1.2,fontFamily:"Body-Bold"},title:{color:t.text,fontSize:fontsize.pageHeader,fontFamily:"Logo-Font",marginTop:3},sectionLabel:{color:t.textMuted,fontSize:12,letterSpacing:1.1,fontFamily:"Body-Bold",marginTop:8},card:{borderRadius:18,backgroundColor:t.backgroundElement,borderWidth:1,borderColor:t.divider,overflow:"hidden"},cardCompact:{borderRadius:18,backgroundColor:t.backgroundElement,borderWidth:1,borderColor:t.divider,padding:spacing.two},stepRow:{minHeight:80,flexDirection:"row",alignItems:"center",gap:12,padding:14},stateRow:{minHeight:66,flexDirection:"row",alignItems:"center",gap:12,paddingHorizontal:16,paddingVertical:10},divider:{borderBottomWidth:1,borderBottomColor:t.divider},number:{width:36,height:36,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:t.primarySoft,borderWidth:1,borderColor:t.primaryBorder},numberText:{color:t.primaryBttn,fontSize:15,fontFamily:"Body-Bold"},stepTitle:{color:t.text,fontSize:16,fontFamily:"Body-Bold"},stepDetail:{color:t.textSecondary,fontSize:14,lineHeight:20,marginTop:2,fontFamily:"Body-Regular"},dot:{width:11,height:11,borderRadius:6},stateLabel:{fontSize:13,letterSpacing:.6,fontFamily:"Body-Bold"},alertText:{color:t.textSecondary,fontSize:15,lineHeight:22,fontFamily:"Body-Regular"}});
